import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OtpService } from './otp.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('OtpService', () => {
  let service: OtpService;
  let prisma: {
    otpRequest: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    user: { update: jest.Mock };
  };
  let mailService: { sendOtpEmail: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(async () => {
    prisma = {
      otpRequest: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      user: { update: jest.fn() },
    };
    mailService = { sendOtpEmail: jest.fn().mockResolvedValue(undefined) };
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'OTP_TTL_SECONDS') return 300;
        if (key === 'OTP_MAX_ATTEMPTS') return 5;
        if (key === 'NODE_ENV') return 'test';
        return fallback;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<OtpService>(OtpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('issue', () => {
    it('creates an otp request with a hashed code and delivers it via mail', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-code');
      prisma.otpRequest.create.mockResolvedValue({ id: 'otp-1' });

      const result = await service.issue('jane@acme.com');

      expect(prisma.otpRequest.create).toHaveBeenCalledWith({
        data: {
          email: 'jane@acme.com',
          otpCodeHash: 'hashed-code',
          expiresAt: expect.any(Date),
        },
      });
      expect(mailService.sendOtpEmail).toHaveBeenCalledWith(
        'jane@acme.com',
        expect.any(String),
        300,
      );
      expect(result).toEqual({ expiresAt: expect.any(Date) });
    });
  });

  describe('verify', () => {
    const baseOtp = {
      id: 'otp-1',
      email: 'jane@acme.com',
      otpCodeHash: 'hashed-code',
      expiresAt: new Date(Date.now() + 60_000),
      attemptCount: 0,
      consumedAt: null,
      createdAt: new Date(),
    };

    it('marks the otp consumed and the user verified when the code matches', async () => {
      prisma.otpRequest.findFirst.mockResolvedValue({ ...baseOtp });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({});
      prisma.otpRequest.update.mockResolvedValue({});

      await service.verify('jane@acme.com', '123456');

      expect(prisma.otpRequest.findFirst).toHaveBeenCalledWith({
        where: { email: 'jane@acme.com', consumedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { email: 'jane@acme.com' },
        data: { isVerified: true },
      });
      expect(prisma.otpRequest.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { consumedAt: expect.any(Date) },
      });
    });

    it('throws UnauthorizedException when there is no pending otp', async () => {
      prisma.otpRequest.findFirst.mockResolvedValue(null);

      await expect(service.verify('jane@acme.com', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the otp has expired', async () => {
      prisma.otpRequest.findFirst.mockResolvedValue({
        ...baseOtp,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.verify('jane@acme.com', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws BadRequestException when the attempt cap has been reached', async () => {
      prisma.otpRequest.findFirst.mockResolvedValue({
        ...baseOtp,
        attemptCount: 5,
      });

      await expect(service.verify('jane@acme.com', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('increments attemptCount and throws UnauthorizedException on a code mismatch', async () => {
      prisma.otpRequest.findFirst.mockResolvedValue({ ...baseOtp });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      prisma.otpRequest.update.mockResolvedValue({});

      await expect(service.verify('jane@acme.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(prisma.otpRequest.update).toHaveBeenCalledWith({
        where: { id: 'otp-1' },
        data: { attemptCount: { increment: 1 } },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
