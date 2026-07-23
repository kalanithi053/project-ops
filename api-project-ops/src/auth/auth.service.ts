import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
   * Unknown usernames are NOT auto-created. Instead the response signals the
   * client to run a create-user step first, via `{ slug: 'Create-User' }`.
   * Existing (active) users get an OTP.
   */
  async requestOtp(
    username: string,
  ): Promise<
    | { message: string; expiresAt: Date }
    | { slug: 'Create-User'; message: string }
  > {
    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user || !user?.email || !user.firstName) {
      return {
        slug: 'Create-User',
        message: 'User not found. Create the user to continue.',
      };
    }

    if (!user.isActive) {
      throw new ForbiddenException('This account is deactivated.');
    }

    const { expiresAt } = await this.otp.issue(username);
    return { message: 'OTP sent', expiresAt };
  }

  /**
   * Create-user step — registers a new user (collected after the requestOtp
   * `Create-User` signal) and immediately issues an OTP.
   */
  async register(dto: RegisterDto): Promise<{
    message: string;
    expiresAt: Date;
    user: { id: string; username: string };
  }> {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existing?.email) {
      throw new ConflictException('Username already exists.');
    }
    let user;
    if (existing) {
      user = await this.prisma.user.update({
        where: {
          username: dto.username,
        },
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          username: dto.username,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
        },
      });

      const { expiresAt } = await this.otp.issue(user.username);
      return {
        message: 'User created, OTP sent',
        expiresAt,
        user: { id: user.id, username: user.username },
      };
    }
  }
  /**
   * Step 2 — verify the OTP and issue the access/refresh token pair. The token
   * carries only the user id; the active workspace is chosen per-request via the
   * `x-workspace-slug` header.
   */
  async verifyOtp(
    username: string,
    otp: string,
  ): Promise<AuthTokens & { user: { id: string; username: string } }> {
    await this.otp.verify(username, otp);

    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account not found or deactivated.');
    }

    return {
      ...this.tokens.signAuthTokens(user.id),
      user: { id: user.id, username: user.username },
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
