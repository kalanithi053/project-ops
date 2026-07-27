import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InviteWorkspaceMemberDto } from './dto/invite-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';

@Injectable()
export class WorkspaceMembersService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        role: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  /** Directly invite a user to the workspace (self-registers unknown emails). */
  async invite(workspaceId: string, dto: InviteWorkspaceMemberDto) {
    const roleId = await this.resolveRoleId(workspaceId, dto.roleId);

    const user = await this.prisma.user.upsert({
      where: { email: dto.email },
      update: {},
      create: { email: dto.email },
    });

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
    });
    if (existing && existing.status !== 'removed') {
      throw new ConflictException('User is already a workspace member.');
    }

    if (existing) {
      return this.prisma.workspaceMember.update({
        where: { id: existing.id },
        data: { status: 'active', roleId },
      });
    }

    return this.prisma.workspaceMember.create({
      data: { workspaceId, userId: user.id, roleId, status: 'active' },
      include: {
        user: { select: { id: true, email: true } },
        role: { select: { id: true, name: true } },
      },
    });
  }

  async update(
    workspaceId: string,
    memberId: string,
    dto: UpdateWorkspaceMemberDto,
  ) {
    const member = await this.getMember(workspaceId, memberId);
    if (dto.roleId) await this.assertRole(workspaceId, dto.roleId);

    if (dto.status === 'removed') {
      await this.assertNotOwner(workspaceId, member.userId);
    }

    return this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: {
        roleId: dto.roleId ?? undefined,
        status: dto.status ?? undefined,
      },
    });
  }

  async remove(workspaceId: string, memberId: string) {
    const member = await this.getMember(workspaceId, memberId);
    await this.assertNotOwner(workspaceId, member.userId);
    await this.prisma.workspaceMember.update({
      where: { id: memberId },
      data: { status: 'removed' },
    });
    return { id: memberId, removed: true };
  }

  // --- helpers ---

  private async resolveRoleId(workspaceId: string, roleId?: string) {
    if (roleId) {
      await this.assertRole(workspaceId, roleId);
      return roleId;
    }
    const defaultRole = await this.prisma.userRole.findFirst({
      where: { workspaceId, isDefault: true },
    });
    if (!defaultRole) {
      throw new BadRequestException('Workspace has no default role.');
    }
    return defaultRole.id;
  }

  private async assertRole(workspaceId: string, roleId: string) {
    const role = await this.prisma.userRole.findFirst({
      where: { id: roleId, workspaceId },
    });
    if (!role) throw new BadRequestException('Role not found in workspace');
    return role;
  }

  private async getMember(workspaceId: string, memberId: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
    });
    if (!member) throw new NotFoundException('Workspace member not found');
    return member;
  }

  private async assertNotOwner(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    if (workspace?.ownerId === userId) {
      throw new BadRequestException('The workspace owner cannot be removed.');
    }
  }
}
