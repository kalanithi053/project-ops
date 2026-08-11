import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ThemeColor, ThemeMode } from '@prisma/client';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { InviteWorkspaceMemberDto } from './dto/invite-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';

@Injectable()
export class WorkspaceMembersService {
  private readonly logger = new Logger(WorkspaceMembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

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
    const role = await this.resolveRole(workspaceId, dto.roleId);

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

    const member = existing
      ? await this.prisma.workspaceMember.update({
          where: { id: existing.id },
          data: { status: 'active', roleId: role.id },
        })
      : await this.prisma.workspaceMember.create({
          data: {
            workspaceId,
            userId: user.id,
            roleId: role.id,
            status: 'active',
          },
          include: {
            user: { select: { id: true, email: true } },
            role: { select: { id: true, name: true } },
          },
        });

    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { name: true },
    });

    await this.mail
      .sendWorkspaceInviteEmail(user.email, {
        workspaceName: workspace.name,
        roleName: role.name,
      })
      .catch((err) =>
        this.logger.error(
          `Failed to send workspace invite email to=${user.email}: ${(err as Error).message}`,
        ),
      );

    return member;
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
      await this.assertProjectNotOwner(workspaceId, member.userId);
      // Mirrors remove()'s cascade: losing workspace access must also drop
      // any project-level access, or reactivating this member later would
      // silently restore access to every project they used to be in.
      await this.prisma.projectMember.deleteMany({
        where: { project: { workspaceId }, userId: member.userId },
      });
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
    await this.assertProjectNotOwner(workspaceId, member.userId);
    await this.prisma.projectMember.deleteMany({
      where: { project: { workspaceId }, userId: member.userId },
    });
    await this.prisma.workspaceMember.delete({
      where: { id: memberId },
    });
    return { id: memberId, removed: true };
  }

  /** The caller's own membership row — role, status and their theme preference. */
  async getOwn(membershipId: string) {
    return this.prisma.workspaceMember.findUniqueOrThrow({
      where: { id: membershipId },
      select: {
        id: true,
        roleId: true,
        status: true,
        isDefault: true,
        theme: true,
        themeColor: true,
      },
    });
  }

  /**
   * Sets the caller's own display-theme preference for this workspace.
   * Self-service — unrestricted by role, since it only ever touches the
   * caller's own row.
   */
  async updateTheme(
    membershipId: string,
    theme: ThemeMode,
    themeColor: ThemeColor,
  ) {
    return this.prisma.workspaceMember.update({
      where: { id: membershipId },
      data: { theme, themeColor },
      select: { id: true, theme: true, themeColor: true },
    });
  }

  // --- helpers ---

  private async resolveRole(workspaceId: string, roleId?: string) {
    if (roleId) {
      return this.assertRole(workspaceId, roleId);
    }
    const defaultRole = await this.prisma.userRole.findFirst({
      where: { workspaceId, isDefault: true },
    });
    if (!defaultRole) {
      throw new BadRequestException('Workspace has no default role.');
    }
    return defaultRole;
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

  private async assertProjectNotOwner(workspaceId: string, userId: string) {
    const workspace = await this.prisma.project.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });
    if (workspace?.ownerId === userId) {
      throw new BadRequestException('The project owner cannot be removed.');
    }
  }
  /**
   * Marks one of the user's workspaces as their default, clearing the flag
   * from any other membership of theirs. Applied immediately (no confirmation
   * step) since it's a pure preference with no side effects on other users.
   */
  async setDefault(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId, status: { not: 'removed' } },
    });
    if (!membership) {
      throw new NotFoundException('Workspace not found or access denied.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.workspaceMember.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
      return tx.workspaceMember.update({
        where: { id: membership.id },
        data: { isDefault: true },
        include: { workspace: true },
      });
    });
  }
}
