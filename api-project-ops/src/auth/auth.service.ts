import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { OtpService } from './otp.service';
import { AuthTokens, TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Step 1 — request an OTP.
   *
   * Unknown emails (and stub users created only via an invite, with no
   * firstName yet) are NOT issued an OTP. Instead the response signals the
   * client to run the register step first, via `{ slug: 'Create-User' }`.
   * Existing, complete, active users get an OTP.
   */
  async requestOtp(
    email: string,
  ): Promise<
    | { message: string; expiresAt: Date }
    | { slug: 'Create-User'; message: string }
  > {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isVerified) {
      return {
        slug: 'Create-User',
        message: 'User not found or not verified. Create the user to continue.',
      };
    }

    const { expiresAt } = await this.otp.issue(email);
    return { message: 'OTP sent', expiresAt };
  }

  /**
   * Create-user step — registers a new user (collected after the requestOtp
   * `Create-User` signal), or completes a stub user pre-created by a workspace/
   * project invite (email only, no firstName), then immediately issues an OTP.
   */
  async register(dto: RegisterDto): Promise<{
    message: string;
    expiresAt: Date;
    user: { id: string; email: string };
  }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing?.email && existing?.isVerified) {
      throw new ConflictException('User already exists.');
    }

    const user = existing
      ? await this.prisma.user.update({
          where: { email: dto.email },
          data: { ...dto, isVerified: false },
        })
      : await this.prisma.user.create({
          data: {
            isVerified: false,
            email: dto.email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            staticOtp: randomInt(0, 1_000_000).toString().padStart(6, '0'),
          },
        });

    const { expiresAt } = await this.otp.issue(user.email);
    return {
      message: 'User created, OTP sent',
      expiresAt,
      user: { id: user.id, email: user.email },
    };
  }

  /**
   * Step 2 — verify the OTP and issue the access/refresh token pair. The token
   * carries only the user id; the active workspace is chosen per-request via the
   * `x-workspace-slug` header.
   */
  async verifyOtp(
    email: string,
    otp: string,
  ): Promise<AuthTokens & { user: { id: string; email: string } }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or deactivated.');
    }

    if (user?.staticOtp === otp) {
      await this.prisma.user.update({
        where: { email: email },
        data: { isVerified: true },
      });
      return {
        ...this.tokens.signAuthTokens(user.id),
        user: { id: user.id, email: user.email },
      };
    }
    await this.otp.verify(email, otp);

    return {
      ...this.tokens.signAuthTokens(user.id),
      user: { id: user.id, email: user.email },
    };
  }

  /** Exchange a refresh token for a fresh access/refresh pair (no new OTP). */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    const payload = this.tokens.verifyRefreshToken(refreshToken);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or deactivated.');
    }

    return this.tokens.signAuthTokens(user.id);
  }
}
