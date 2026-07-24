import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Reports the permission codes a user is allowed, resolved from the relevant
 * role: the workspace role for workspace scope, the project role
 * (ProjectMember) for a specific project.
 */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Permissions granted by the caller's workspace role. */
  async workspacePermissions(workspaceId: string, roleId: string) {
    const role = await this.prisma.userRole.findUnique({
      where: { id: roleId },
      select: { id: true, name: true },
    });
    return {
      scope: 'workspace' as const,
      workspaceId,
      role,
      permissions: await this.permissionCodes(roleId),
    };
  }

  /** Permissions granted by the caller's project role for a given project. */
  async projectPermissions(
    workspaceId: string,
    projectId: string,
    userId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const membership = await this.prisma.projectMember.findFirst({
      where: { projectId, userId, status: { not: 'removed' } },
      include: { role: { select: { id: true, name: true } } },
    });

    if (!membership) {
      return {
        scope: 'project' as const,
        projectId,
        isMember: false,
        role: null,
        permissions: [] as string[],
      };
    }

    return {
      scope: 'project' as const,
      projectId,
      isMember: true,
      role: membership.role,
      permissions: await this.permissionCodes(membership.roleId),
    };
  }

  private async permissionCodes(roleId: string): Promise<string[]> {
    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { code: true } } },
    });
    return rows.map((r) => r.permission.code).sort();
  }
}
