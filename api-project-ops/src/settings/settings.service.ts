import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateWorkspaceSettingsDto } from './dto/update-workspace-settings.dto';

/**
 * Aggregates all workspace configuration into one payload the frontend can use
 * to bootstrap: workspace details, plans (each with its modules), ticket
 * statuses, priorities, roles (with permissions) and the permission catalog.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async updateWorkspace(workspaceId: string, dto: UpdateWorkspaceSettingsDto) {
    if (dto.name === undefined && dto.slug === undefined) {
      throw new BadRequestException(
        'At least one of name or slug must be provided.',
      );
    }

    if (dto.slug !== undefined) {
      const existing = await this.prisma.workspace.findFirst({
        where: { slug: dto.slug, id: { not: workspaceId } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('Workspace slug is already in use.');
      }
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    try {
      return await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: dto,
        select: {
          id: true,
          name: true,
          slug: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error) {
      // Protect against a concurrent request claiming the slug after the
      // friendly pre-check above.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Workspace slug is already in use.');
      }
      throw error;
    }
  }

  async getSettings(workspaceId: string) {
    const [
      workspace,
      plans,
      ticketStatuses,
      priorities,
      projectTypes,
      roles,
      permissions,
    ] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          slug: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.plan.findMany({
        where: { workspaceId },
        orderBy: { name: 'asc' },
        include: {
          modules: {
            orderBy: { name: 'asc' },
            select: {
              id: true,
              key: true,
              name: true,
              defaultTaskLimit: true,
              isDefault: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.ticketStatus.findMany({
        where: { workspaceId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.priority.findMany({
        where: { workspaceId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.projectType.findMany({
        where: { workspaceId },
        orderBy: { name: 'asc' },
        include: {
          plans: { select: { id: true, name: true, isActive: true } },
        },
      }),
      this.prisma.userRole.findMany({
        where: { workspaceId },
        orderBy: { name: 'asc' },
        include: {
          rolePermissions: {
            select: { permission: { select: { code: true } } },
          },
        },
      }),
      this.prisma.userPermission.findMany({
        where: { workspaceId },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, description: true },
      }),
    ]);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return {
      workspace,
      activePlan: plans.find((p) => p.isActive)?.id ?? null,
      plans,
      ticketStatuses,
      priorities,
      projectTypes,
      roles: roles.map((r) => ({
        id: r.id,
        name: r.name,
        isDefault: r.isDefault,
        isSystem: r.isSystem,
        permissions: r.rolePermissions.map((rp) => rp.permission.code).sort(),
      })),
      permissions,
    };
  }
}
