import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Aggregates all workspace configuration into one payload the frontend can use
 * to bootstrap: workspace details, plans (each with its modules), ticket
 * statuses, priorities, roles (with permissions) and the permission catalog.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(workspaceId: string) {
    const [workspace, plans, ticketStatuses, priorities, roles, permissions] =
      await Promise.all([
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
