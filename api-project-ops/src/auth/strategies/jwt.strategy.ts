import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AnyJwtPayload } from '../../common/types/jwt-payload';

/**
 * Verifies the bearer token signature/expiry and hands the decoded payload to
 * `request.user`. Only "access" tokens are accepted here; "refresh" tokens are
 * rejected so they can only be spent at /auth/token/refresh.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: AnyJwtPayload): AnyJwtPayload {
    if (!payload?.sub || !payload?.type) {
      throw new UnauthorizedException('Malformed token');
    }
    if (payload.type === 'refresh') {
      throw new UnauthorizedException(
        'Refresh tokens cannot be used for authentication',
      );
    }
    return payload;
  }
}
