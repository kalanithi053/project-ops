import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InviteProjectMemberDto } from './dto/invite-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';

@Injectable()
export class ProjectMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: { select: { id: true, username: true } },
        role: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Invites a user to a project. If the invitee is not yet a workspace member
   * they are auto-invited to the workspace too. Unknown usernames are
   * self-registered.
   */
  async invite(
    workspaceId: string,
    projectId: string,
    invitedBy: string,
    dto: InviteProjectMemberDto,
  ) {
    await this.assertProject(workspaceId, projectId);
    await this.assertRole(workspaceId, dto.roleId);

    const user = await this.prisma.user.upsert({
      where: { username: dto.username },
      update: {},
      create: { username: dto.username },
    });

    await this.ensureWorkspaceMembership(workspaceId, user.id);

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    });
    if (existing) {
      throw new ConflictException(
        'User is already a member of this project.',
      );
    }

    const member = await this.prisma.projectMember.create({
      data: {
        projectId,
        userId: user.id,
        roleId: dto.roleId,
        invitedBy,
        status: 'invited',
      },
      include: {
        user: { select: { id: true, username: true } },
        role: { select: { id: true, name: true } },
      },
    });

    // Stub notification.
    return { ...member, message: 'Member invited' };
  }

  async update(
    workspaceId: string,
    projectId: string,
    memberId: string,
    dto: UpdateProjectMemberDto,
  ) {
    await this.getMember(workspaceId, projectId, memberId);
    if (dto.roleId) await this.assertRole(workspaceId, dto.roleId);
    return this.prisma.projectMember.update({
      where: { id: memberId },
      data: {
        roleId: dto.roleId ?? undefined,
        status: dto.status ?? undefined,
      },
    });
  }

  async remove(workspaceId: string, projectId: string, memberId: string) {
    const member = await this.getMember(workspaceId, projectId, memberId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (project?.ownerId === member.userId) {
      throw new BadRequestException(
        'The project owner cannot be removed.',
      );
    }
    await this.prisma.projectMember.update({
      where: { id: memberId },
      data: { status: 'removed' },
    });
    return { id: memberId, removed: true };
  }

  // --- helpers ---

  private async ensureWorkspaceMembership(workspaceId: string, userId: string) {
    const membership = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (membership) {
      if (membership.status === 'removed') {
        await this.prisma.workspaceMember.update({
          where: { id: membership.id },
          data: { status: 'invited' },
        });
      }
      return;
    }

    const defaultRole = await this.prisma.userRole.findFirst({
      where: { workspaceId, isDefault: true },
    });
    if (!defaultRole) {
      throw new BadRequestException(
        'Workspace has no default role to assign the new member.',
      );
    }

    await this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        roleId: defaultRole.id,
        status: 'invited',
      },
    });
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async assertRole(workspaceId: string, roleId: string) {
    const role = await this.prisma.userRole.findFirst({
      where: { id: roleId, workspaceId },
    });
    if (!role) throw new BadRequestException('Role not found in workspace');
    return role;
  }

  private async getMember(
    workspaceId: string,
    projectId: string,
    memberId: string,
  ) {
    await this.assertProject(workspaceId, projectId);
    const member = await this.prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });
    if (!member) throw new NotFoundException('Project member not found');
    return member;
  }
}
