import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Current user profile. When a workspace slug is supplied (via the
   * `x-workspace-slug` header) and the user is an active member, the response is
   * enriched with that workspace, the user's role in it, and the flat list of
   * permission codes they are allowed. Without a valid workspace context, the
   * `workspace` and `permissions` fields are omitted entirely.
   */
  async getProfile(userId: string, workspaceSlug?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        createdAt: true,
        productTourCompletedAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { ...user };
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });
  }

  /** Marks the onboarding product tour as seen (finished or skipped). */
  async completeProductTour(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { productTourCompletedAt: new Date() },
      select: { id: true, productTourCompletedAt: true },
    });
  }
}
