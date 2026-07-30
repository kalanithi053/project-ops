import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';
import { RefreshJwtPayload } from '../common/types/jwt-payload';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };
    configService = {
      get: jest.fn((_key: string, fallback?: unknown) => fallback),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('signAuthTokens', () => {
    it('signs an access and refresh token pair for the user id', () => {
      jwtService.sign
        .mockReturnValueOnce('access-token-value')
        .mockReturnValueOnce('refresh-token-value');

      const result = service.signAuthTokens('user-1');

      expect(result).toEqual({
        accessToken: 'access-token-value',
        refreshToken: 'refresh-token-value',
        tokenType: 'Bearer',
      });

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sub: 'user-1', type: 'access' },
        { expiresIn: '15m' },
      );
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sub: 'user-1', type: 'refresh' },
        { expiresIn: '7d' },
      );
    });

    it('uses configured expiry overrides when present', () => {
      configService.get.mockImplementation((key: string, fallback?: unknown) => {
        if (key === 'JWT_ACCESS_EXPIRATION') return '30m';
        if (key === 'JWT_REFRESH_EXPIRATION') return '14d';
        return fallback;
      });
      jwtService.sign.mockReturnValueOnce('a').mockReturnValueOnce('r');

      service.signAuthTokens('user-2');

      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        { sub: 'user-2', type: 'access' },
        { expiresIn: '30m' },
      );
      expect(jwtService.sign).toHaveBeenNthCalledWith(
        2,
        { sub: 'user-2', type: 'refresh' },
        { expiresIn: '14d' },
      );
    });
  });

  describe('verifyRefreshToken', () => {
    it('returns the payload when the token is a valid refresh token', () => {
      const payload: RefreshJwtPayload = { sub: 'user-1', type: 'refresh' };
      jwtService.verify.mockReturnValue(payload);

      const result = service.verifyRefreshToken('some-refresh-token');

      expect(result).toEqual(payload);
      expect(jwtService.verify).toHaveBeenCalledWith('some-refresh-token');
    });

    it('throws UnauthorizedException when the token type is not refresh', () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1', type: 'access' });

      expect(() => service.verifyRefreshToken('access-token-used-as-refresh')).toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when jwt.verify throws (invalid/expired token)', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      expect(() => service.verifyRefreshToken('bad-token')).toThrow(
        UnauthorizedException,
      );
    });
  });
});
