import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
  };
  let otpService: { issue: jest.Mock; verify: jest.Mock };
  let tokenService: { signAuthTokens: jest.Mock; verifyRefreshToken: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    otpService = {
      issue: jest.fn(),
      verify: jest.fn(),
    };
    tokenService = {
      signAuthTokens: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: OtpService, useValue: otpService },
        { provide: TokenService, useValue: tokenService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requestOtp', () => {
    it('signals Create-User when no user exists for the email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.requestOtp('unknown@acme.com');

      expect(result).toEqual({
        slug: 'Create-User',
        message: 'User not found or not verified. Create the user to continue.',
      });
      expect(otpService.issue).not.toHaveBeenCalled();
    });

    it('signals Create-User when the user exists but is not verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'stub@acme.com',
        isVerified: false,
      });

      const result = await service.requestOtp('stub@acme.com');

      expect(result).toEqual({
        slug: 'Create-User',
        message: 'User not found or not verified. Create the user to continue.',
      });
      expect(otpService.issue).not.toHaveBeenCalled();
    });

    it('issues an otp for an existing verified user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'jane@acme.com',
        isVerified: true,
      });
      const expiresAt = new Date();
      otpService.issue.mockResolvedValue({ expiresAt });

      const result = await service.requestOtp('jane@acme.com');

      expect(otpService.issue).toHaveBeenCalledWith('jane@acme.com');
      expect(result).toEqual({ message: 'OTP sent', expiresAt });
    });
  });

  describe('register', () => {
    const dto: RegisterDto = {
      email: 'jane@acme.com',
      firstName: 'Jane',
      lastName: 'Doe',
    };

    it('throws ConflictException when a verified user already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        email: 'jane@acme.com',
        isVerified: true,
      });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('creates a brand-new user when none exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'jane@acme.com',
      });
      const expiresAt = new Date();
      otpService.issue.mockResolvedValue({ expiresAt });

      const result = await service.register(dto);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          isVerified: false,
          email: 'jane@acme.com',
          firstName: 'Jane',
          lastName: 'Doe',
          staticOtp: expect.any(String),
        },
      });
      expect(otpService.issue).toHaveBeenCalledWith('jane@acme.com');
      expect(result).toEqual({
        message: 'User created, OTP sent',
        expiresAt,
        user: { id: 'user-1', email: 'jane@acme.com' },
      });
    });

    it('completes an unverified stub user (invited but never registered)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'stub-1',
        email: 'jane@acme.com',
        isVerified: false,
      });
      prisma.user.update.mockResolvedValue({
        id: 'stub-1',
        email: 'jane@acme.com',
      });
      const expiresAt = new Date();
      otpService.issue.mockResolvedValue({ expiresAt });

      const result = await service.register(dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'jane@acme.com' },
        data: { ...dto, isVerified: false },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result.user).toEqual({ id: 'stub-1', email: 'jane@acme.com' });
    });
  });

  describe('verifyOtp', () => {
    it('throws UnauthorizedException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyOtp('jane@acme.com', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the user is deactivated', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'jane@acme.com',
        isActive: false,
        staticOtp: '123456',
      });

      await expect(service.verifyOtp('jane@acme.com', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('bypasses otp.verify and issues tokens when the code matches the static otp', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'jane@acme.com',
        isActive: true,
        staticOtp: '123456',
      });
      prisma.user.update.mockResolvedValue({});
      tokenService.signAuthTokens.mockReturnValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenType: 'Bearer',
      });

      const result = await service.verifyOtp('jane@acme.com', '123456');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'jane@acme.com' },
        data: { isVerified: true },
      });
      expect(otpService.verify).not.toHaveBeenCalled();
      expect(result).toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenType: 'Bearer',
        user: { id: 'user-1', email: 'jane@acme.com' },
      });
    });

    it('delegates to otp.verify and issues tokens when the code does not match the static otp', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'jane@acme.com',
        isActive: true,
        staticOtp: '999999',
      });
      otpService.verify.mockResolvedValue(undefined);
      tokenService.signAuthTokens.mockReturnValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenType: 'Bearer',
      });

      const result = await service.verifyOtp('jane@acme.com', '123456');

      expect(otpService.verify).toHaveBeenCalledWith('jane@acme.com', '123456');
      expect(result).toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenType: 'Bearer',
        user: { id: 'user-1', email: 'jane@acme.com' },
      });
    });

    it('propagates the UnauthorizedException thrown by otp.verify on a bad code', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'jane@acme.com',
        isActive: true,
        staticOtp: '999999',
      });
      otpService.verify.mockRejectedValue(
        new UnauthorizedException('Invalid OTP.'),
      );

      await expect(service.verifyOtp('jane@acme.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when the user no longer exists', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: 'user-1',
        type: 'refresh',
      });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh('refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the user is deactivated', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: 'user-1',
        type: 'refresh',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: false,
      });

      await expect(service.refresh('refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('mints a fresh token pair for a valid refresh token', async () => {
      tokenService.verifyRefreshToken.mockReturnValue({
        sub: 'user-1',
        type: 'refresh',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: true,
      });
      tokenService.signAuthTokens.mockReturnValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        tokenType: 'Bearer',
      });

      const result = await service.refresh('refresh-token');

      expect(tokenService.verifyRefreshToken).toHaveBeenCalledWith(
        'refresh-token',
      );
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(tokenService.signAuthTokens).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        tokenType: 'Bearer',
      });
    });
  });
});
