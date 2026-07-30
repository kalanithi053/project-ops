import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import {
  AccessJwtPayload,
  RefreshJwtPayload,
} from '../common/types/jwt-payload';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
}

/** Mints and verifies the access/refresh token pair. */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /** Access + refresh pair for a user (no workspace context in the token). */
  signAuthTokens(userId: string): AuthTokens {
    const accessPayload: AccessJwtPayload = { sub: userId, type: 'access' };
    const refreshPayload: RefreshJwtPayload = { sub: userId, type: 'refresh' };

    return {
      accessToken: this.jwt.sign(accessPayload, {
        expiresIn: this.expiry('JWT_ACCESS_EXPIRATION', '15m'),
      }),
      refreshToken: this.jwt.sign(refreshPayload, {
        expiresIn: this.expiry('JWT_REFRESH_EXPIRATION', '7d'),
      }),
      tokenType: 'Bearer',
    };
  }

  /** Verifies a refresh token and returns its payload, or throws 401. */
  verifyRefreshToken(token: string): RefreshJwtPayload {
    try {
      const payload = this.jwt.verify<RefreshJwtPayload>(token);
      if (payload.type !== 'refresh') {
        throw new Error('wrong token type');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  /**
   * ms-style duration ('15m', '7d'), cast to `StringValue` because
   * @types/jsonwebtoken types expiresIn as that template literal, which a
   * runtime-configured string can't satisfy on its own.
   */
  private expiry(key: string, fallback: string): StringValue {
    return this.config.get<string>(key, fallback) as StringValue;
  }
}
