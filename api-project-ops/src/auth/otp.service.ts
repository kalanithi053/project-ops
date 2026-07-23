import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Passwordless OTP: generate a 6-digit code, store only its bcrypt hash, and
 * verify against the latest unconsumed challenge for a username. Delivery is
 * stubbed (logged in dev) — wire an SMS/email provider in `deliver()`.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly ttlSeconds: number;
  private readonly maxAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.ttlSeconds = Number(this.config.get('OTP_TTL_SECONDS', 300));
    this.maxAttempts = Number(this.config.get('OTP_MAX_ATTEMPTS', 5));
  }

  /** Creates and "sends" a fresh OTP for the given username. */
  async issue(username: string): Promise<{ expiresAt: Date }> {
    const code = '123456';
    const otpCodeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + this.ttlSeconds * 1000);

    await this.prisma.otpRequest.create({
      data: { username, otpCodeHash, expiresAt },
    });

    this.deliver(username, code);
    return { expiresAt };
  }

  /**
   * Validates a code against the latest unconsumed, unexpired challenge.
   * Marks it consumed on success; increments attemptCount and enforces the cap
   * on failure. Throws 401 on any mismatch.
   */
  async verify(username: string, code: string): Promise<void> {
    const otp = await this.prisma.otpRequest.findFirst({
      where: { username, consumedAt: null },
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

  /** Stub delivery — replace with a real SMS/email transport in production. */
  private deliver(username: string, code: string): void {
    this.logger.log(`[OTP] username=${username} code=${code}`);
  }
}
