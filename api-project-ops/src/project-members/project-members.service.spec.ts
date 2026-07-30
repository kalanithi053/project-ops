import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectMembersService } from './project-members.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { InviteProjectMemberDto } from './dto/invite-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';

describe('ProjectMembersService', () => {
  let service: ProjectMembersService;
  let prisma: {
    project: { findFirst: jest.Mock; findUnique: jest.Mock };
    projectMember: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    user: { findUnique: jest.Mock; create: jest.Mock };
    userRole: { findFirst: jest.Mock };
    workspaceMember: {
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
  };
  let mail: { sendProjectInviteEmail: jest.Mock };

  const workspaceId = 'ws-1';
  const projectId = 'proj-1';
  const invitedBy = 'user-inviter';

  beforeEach(async () => {
    prisma = {
      project: { findFirst: jest.fn(), findUnique: jest.fn() },
      projectMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: { findUnique: jest.fn(), create: jest.fn() },
      userRole: { findFirst: jest.fn() },
      workspaceMember: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    mail = { sendProjectInviteEmail: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectMembersService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
      ],
    }).compile();

    service = module.get<ProjectMembersService>(ProjectMembersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const project = {
    id: projectId,
    workspaceId,
    name: 'Website Revamp',
    ownerId: 'owner-1',
    deletedAt: null,
  };

  describe('list', () => {
    it('returns project members on the happy path', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      const members = [
        {
          id: 'pm-1',
          projectId,
          userId: 'user-1',
          roleId: 'role-1',
          status: 'active',
          user: { id: 'user-1', email: 'a@b.com', firstName: 'A', lastName: 'B' },
          role: { id: 'role-1', name: 'Owner' },
        },
      ];
      prisma.projectMember.findMany.mockResolvedValue(members);

      const result = await service.list(workspaceId, projectId);

      expect(result).toEqual(members);
      expect(prisma.projectMember.findMany).toHaveBeenCalledWith({
        where: { projectId },
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          role: { select: { id: true, name: true } },
        },
      });
    });

    it('throws NotFoundException when the project does not exist in the workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.list(workspaceId, projectId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.projectMember.findMany).not.toHaveBeenCalled();
    });
  });

  describe('invite', () => {
    const dto: InviteProjectMemberDto = {
      email: 'new@acme.com',
      roleId: 'role-1',
    };
    const role = { id: 'role-1', workspaceId, name: 'Member' };

    it('invites a brand-new user, auto-joins the workspace, and sends the email', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.userRole.findFirst
        .mockResolvedValueOnce(role) // assertRole
        .mockResolvedValueOnce({ id: 'default-role', workspaceId, isDefault: true }); // ensureWorkspaceMembership default role
      prisma.user.findUnique.mockResolvedValue(null);
      const newUser = { id: 'user-new', email: dto.email, isVerified: false };
      prisma.user.create.mockResolvedValue(newUser);
      prisma.workspaceMember.findUnique.mockResolvedValue(null);
      prisma.workspaceMember.create.mockResolvedValue({});
      prisma.projectMember.findUnique.mockResolvedValue(null);
      const createdMember = {
        id: 'pm-1',
        projectId,
        userId: newUser.id,
        roleId: dto.roleId,
        user: { id: newUser.id, email: newUser.email },
        role: { id: role.id, name: role.name },
      };
      prisma.projectMember.create.mockResolvedValue(createdMember);

      const result = await service.invite(
        workspaceId,
        projectId,
        invitedBy,
        dto,
      );

      expect(result).toEqual({ ...createdMember, message: 'Member invited' });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: { email: dto.email, isVerified: false },
      });
      expect(prisma.workspaceMember.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          userId: newUser.id,
          roleId: 'default-role',
          status: 'active',
        },
      });
      expect(prisma.projectMember.create).toHaveBeenCalledWith({
        data: {
          projectId,
          userId: newUser.id,
          roleId: dto.roleId,
          invitedBy,
          status: 'active',
        },
        include: {
          user: { select: { id: true, email: true } },
          role: { select: { id: true, name: true } },
        },
      });
      expect(mail.sendProjectInviteEmail).toHaveBeenCalledWith(newUser.email, {
        projectName: project.name,
        roleName: role.name,
      });
    });

    it('reuses an existing user and existing active workspace membership without re-creating it', async () => {
      const existingUser = { id: 'user-existing', email: dto.email };
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.userRole.findFirst.mockResolvedValue(role);
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.workspaceMember.findUnique.mockResolvedValue({
        id: 'wsm-1',
        status: 'active',
      });
      prisma.projectMember.findUnique.mockResolvedValue(null);
      prisma.projectMember.create.mockResolvedValue({
        id: 'pm-2',
        projectId,
        userId: existingUser.id,
      });

      await service.invite(workspaceId, projectId, invitedBy, dto);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.workspaceMember.create).not.toHaveBeenCalled();
      expect(prisma.workspaceMember.update).not.toHaveBeenCalled();
    });

    it('reactivates a removed workspace membership instead of creating a new one', async () => {
      const existingUser = { id: 'user-existing', email: dto.email };
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.userRole.findFirst.mockResolvedValue(role);
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.workspaceMember.findUnique.mockResolvedValue({
        id: 'wsm-1',
        status: 'removed',
      });
      prisma.workspaceMember.update.mockResolvedValue({});
      prisma.projectMember.findUnique.mockResolvedValue(null);
      prisma.projectMember.create.mockResolvedValue({
        id: 'pm-2',
        projectId,
        userId: existingUser.id,
      });

      await service.invite(workspaceId, projectId, invitedBy, dto);

      expect(prisma.workspaceMember.update).toHaveBeenCalledWith({
        where: { id: 'wsm-1' },
        data: { status: 'active' },
      });
      expect(prisma.workspaceMember.create).not.toHaveBeenCalled();
    });

    it('logs but does not throw when the invite email fails to send', async () => {
      const existingUser = { id: 'user-existing', email: dto.email };
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.userRole.findFirst.mockResolvedValue(role);
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.workspaceMember.findUnique.mockResolvedValue({
        id: 'wsm-1',
        status: 'active',
      });
      prisma.projectMember.findUnique.mockResolvedValue(null);
      prisma.projectMember.create.mockResolvedValue({
        id: 'pm-2',
        projectId,
        userId: existingUser.id,
      });
      mail.sendProjectInviteEmail.mockRejectedValue(new Error('smtp down'));

      await expect(
        service.invite(workspaceId, projectId, invitedBy, dto),
      ).resolves.toBeDefined();
    });

    it('throws NotFoundException when the project does not exist in the workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.invite(workspaceId, projectId, invitedBy, dto),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.projectMember.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the role does not exist in the workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.userRole.findFirst.mockResolvedValue(null);

      await expect(
        service.invite(workspaceId, projectId, invitedBy, dto),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.projectMember.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the user is already a member of the project', async () => {
      const existingUser = { id: 'user-existing', email: dto.email };
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.userRole.findFirst.mockResolvedValue(role);
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.workspaceMember.findUnique.mockResolvedValue({
        id: 'wsm-1',
        status: 'active',
      });
      prisma.projectMember.findUnique.mockResolvedValue({
        id: 'pm-existing',
        projectId,
        userId: existingUser.id,
      });

      await expect(
        service.invite(workspaceId, projectId, invitedBy, dto),
      ).rejects.toThrow(ConflictException);
      expect(prisma.projectMember.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the workspace has no default role for a brand-new membership', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.userRole.findFirst
        .mockResolvedValueOnce(role) // assertRole
        .mockResolvedValueOnce(null); // no default role
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'user-new', email: dto.email });
      prisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(
        service.invite(workspaceId, projectId, invitedBy, dto),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.projectMember.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const memberId = 'pm-1';
    const member = { id: memberId, projectId, userId: 'user-1' };

    it('updates role and status on the happy path', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.projectMember.findFirst.mockResolvedValue(member);
      prisma.userRole.findFirst.mockResolvedValue({
        id: 'role-2',
        workspaceId,
      });
      const dto: UpdateProjectMemberDto = { roleId: 'role-2', status: 'active' };
      const updated = { ...member, roleId: dto.roleId, status: dto.status };
      prisma.projectMember.update.mockResolvedValue(updated);

      const result = await service.update(
        workspaceId,
        projectId,
        memberId,
        dto,
      );

      expect(result).toEqual(updated);
      expect(prisma.projectMember.update).toHaveBeenCalledWith({
        where: { id: memberId },
        data: { roleId: dto.roleId, status: dto.status },
      });
    });

    it('skips role validation when roleId is not provided', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.projectMember.findFirst.mockResolvedValue(member);
      prisma.projectMember.update.mockResolvedValue({
        ...member,
        status: 'removed',
      });

      await service.update(workspaceId, projectId, memberId, {
        status: 'removed',
      });

      expect(prisma.userRole.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the project does not exist in the workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, projectId, memberId, {}),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.projectMember.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the member does not belong to the project', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.projectMember.findFirst.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, projectId, memberId, {}),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.projectMember.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the new role does not exist in the workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.projectMember.findFirst.mockResolvedValue(member);
      prisma.userRole.findFirst.mockResolvedValue(null);

      await expect(
        service.update(workspaceId, projectId, memberId, { roleId: 'bad' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.projectMember.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const memberId = 'pm-1';
    const member = { id: memberId, projectId, userId: 'user-not-owner' };

    it('marks the member as removed on the happy path', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.projectMember.findFirst.mockResolvedValue(member);
      prisma.project.findUnique.mockResolvedValue({ ownerId: project.ownerId });
      prisma.projectMember.update.mockResolvedValue({
        ...member,
        status: 'removed',
      });

      const result = await service.remove(workspaceId, projectId, memberId);

      expect(result).toEqual({ id: memberId, removed: true });
      expect(prisma.projectMember.update).toHaveBeenCalledWith({
        where: { id: memberId },
        data: { status: 'removed' },
      });
    });

    it('throws NotFoundException when the project does not exist in the workspace', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(workspaceId, projectId, memberId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.projectMember.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the member does not belong to the project', async () => {
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.projectMember.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(workspaceId, projectId, memberId),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.projectMember.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when trying to remove the project owner', async () => {
      const ownerMember = { id: memberId, projectId, userId: project.ownerId };
      prisma.project.findFirst.mockResolvedValue(project);
      prisma.projectMember.findFirst.mockResolvedValue(ownerMember);
      prisma.project.findUnique.mockResolvedValue({ ownerId: project.ownerId });

      await expect(
        service.remove(workspaceId, projectId, memberId),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.projectMember.update).not.toHaveBeenCalled();
    });
  });
});
