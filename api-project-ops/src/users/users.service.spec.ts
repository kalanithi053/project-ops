import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('returns the profile for an existing user', async () => {
      const user = {
        id: 'user-1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@acme.com',
        isActive: true,
        createdAt: new Date('2024-01-01'),
        productTourCompletedAt: null,
        isTourDone: false,
      };
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getProfile('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
          createdAt: true,
          productTourCompletedAt: true,
          isTourDone: true,
        },
      });
      expect(result).toEqual(user);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('missing-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('updates and returns the profile fields', async () => {
      const dto: UpdateUserDto = { firstName: 'Janet' };
      const updated = {
        id: 'user-1',
        firstName: 'Janet',
        lastName: 'Doe',
        email: 'jane@acme.com',
      };
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.updateProfile('user-1', dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: dto,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isTourDone: true,
        },
      });
      expect(result).toEqual(updated);
    });
  });
});
