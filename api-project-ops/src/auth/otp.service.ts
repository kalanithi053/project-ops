import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Passwordless OTP: generate a 6-digit code, store only its bcrypt hash, and
 * verify against the latest unconsumed challenge for an email. Delivery goes
 * out via `MailService`.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly ttlSeconds: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {
    this.ttlSeconds = Number(this.config.get('OTP_TTL_SECONDS', 300));
    this.maxAttempts = Number(this.config.get('OTP_MAX_ATTEMPTS', 5));
  }

  /**
   * Creates and "sends" a fresh OTP for the given email. Uses the user's
   * `staticOtp` (a fixed per-user dev code) when set; otherwise generates a
   * random 6-digit code.
   */
  async issue(email: string): Promise<{ expiresAt: Date }> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const otpCodeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    await this.prisma.otpRequest.create({
      data: { email, otpCodeHash, expiresAt },
    });

    await this.deliver(email, code);
    return { expiresAt };
  }

  /**
   * Validates a code against the latest unconsumed, unexpired challenge.
   * Marks it consumed on success; increments attemptCount and enforces the cap
   * on failure. Throws 401 on any mismatch.
   */
  async verify(email: string, code: string): Promise<void> {
    const otp = await this.prisma.otpRequest.findFirst({
      where: { email, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new UnauthorizedException('No pending OTP. Request a new code.');
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('OTP has expired. Request a new code.');
    }

    if (otp.attemptCount >= this.maxAttempts) {
      throw new BadRequestException('Too many attempts. Request a new code.');
    }

    const matches = await bcrypt.compare(code, otp.otpCodeHash);
    if (!matches) {
      await this.prisma.otpRequest.update({
        where: { id: otp.id },
        data: { attemptCount: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid OTP.');
    }

    await this.prisma.otpRequest.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }

  private async deliver(email: string, code: string): Promise<void> {
    if (this.config.get('NODE_ENV') !== 'production') {
      this.logger.log(`[OTP] email=${email} code=${code}`);
    }
    await this.mail.sendOtpEmail(email, code, this.ttlSeconds);
  }
}
