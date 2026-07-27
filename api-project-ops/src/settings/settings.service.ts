import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateWorkspaceSettingsDto } from './dto/update-workspace-settings.dto';

/** The workspace fields exposed by the settings endpoints. */
const WORKSPACE_SELECT = {
  id: true,
  name: true,
  slug: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Aggregates all workspace configuration into one payload the frontend can use
 * to bootstrap: workspace details, plans (each with its modules), ticket
 * statuses, priorities, roles (with permissions) and the permission catalog.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Updates the workspace's display name and/or URL slug.
   *
   * The slug is globally unique and doubles as the tenant header, so a
   * collision is reported as a 409 rather than surfacing a raw Prisma error.
   */
  async updateWorkspace(workspaceId: string, dto: UpdateWorkspaceSettingsDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: WORKSPACE_SELECT,
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const name = dto.name?.trim();
    const slug = dto.slug?.trim();

    if (name === undefined && slug === undefined) {
      throw new BadRequestException('Provide a name or slug to update.');
    }

    if (slug !== undefined && slug !== workspace.slug) {
      const taken = await this.prisma.workspace.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (taken) {
        throw new ConflictException(`The URL "${slug}" is already taken.`);
      }
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
      },
      select: WORKSPACE_SELECT,
    });
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
          select: WORKSPACE_SELECT,
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
