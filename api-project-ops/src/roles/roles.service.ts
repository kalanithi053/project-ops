import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string) {
    const roles = await this.prisma.userRole.findMany({
      where: { workspaceId },
      include: {
        rolePermissions: { include: { permission: { select: { code: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      isDefault: r.isDefault,
      isSystem: r.isSystem,
      permissions: r.rolePermissions.map((rp) => rp.permission.code),
    }));
  }

  async create(workspaceId: string, dto: CreateRoleDto) {
    await this.assertNameFree(workspaceId, dto.name);
    const permissionIds = await this.resolvePermissionIds(
      workspaceId,
      dto.permissionCodes,
    );

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await this.clearDefault(tx, workspaceId);
      const role = await tx.userRole.create({
        data: {
          workspaceId,
          name: dto.name,
          isDefault: dto.isDefault ?? false,
        },
      });
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
        });
      }
      return role;
    });
  }

  async update(workspaceId: string, roleId: string, dto: UpdateRoleDto) {
    const role = await this.getOwned(workspaceId, roleId);

    if (dto.name && dto.name !== role.name) {
      await this.assertNameFree(workspaceId, dto.name);
    }

    const permissionIds =
      dto.permissionCodes !== undefined
        ? await this.resolvePermissionIds(workspaceId, dto.permissionCodes)
        : null;

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await this.clearDefault(tx, workspaceId);

      const updated = await tx.userRole.update({
        where: { id: roleId },
        data: {
          name: dto.name ?? undefined,
          isDefault: dto.isDefault ?? undefined,
        },
      });

      if (permissionIds !== null) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permissionId) => ({
              roleId,
              permissionId,
            })),
          });
        }
      }
      return updated;
    });
  }

  async remove(workspaceId: string, roleId: string) {
    const role = await this.getOwned(workspaceId, roleId);
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted.');
    }

    const inUse = await this.prisma.workspaceMember.count({ where: { roleId } });
    const inUseProjects = await this.prisma.projectMember.count({
      where: { roleId },
    });
    if (inUse + inUseProjects > 0) {
      throw new ConflictException(
        'Role is still assigned to members; reassign them first.',
      );
    }

    await this.prisma.userRole.delete({ where: { id: roleId } });
    return { id: roleId, deleted: true };
  }

  // --- helpers ---

  private async getOwned(workspaceId: string, roleId: string) {
    const role = await this.prisma.userRole.findFirst({
      where: { id: roleId, workspaceId },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  private async assertNameFree(workspaceId: string, name: string) {
    const existing = await this.prisma.userRole.findFirst({
      where: { workspaceId, name },
    });
    if (existing) {
      throw new ConflictException(`A role named "${name}" already exists.`);
    }
  }

  private async clearDefault(tx: Prisma.TransactionClient, workspaceId: string) {
    await tx.userRole.updateMany({
      where: { workspaceId, isDefault: true },
      data: { isDefault: false },
    });
  }

  private async resolvePermissionIds(
    workspaceId: string,
    codes?: string[],
  ): Promise<string[]> {
    if (!codes || codes.length === 0) return [];
    const perms = await this.prisma.userPermission.findMany({
      where: { workspaceId, code: { in: codes } },
      select: { id: true, code: true },
    });
    const found = new Set(perms.map((p) => p.code));
    const unknown = codes.filter((c) => !found.has(c));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown permission code(s): ${unknown.join(', ')}`,
      );
    }
    return perms.map((p) => p.id);
  }
}
