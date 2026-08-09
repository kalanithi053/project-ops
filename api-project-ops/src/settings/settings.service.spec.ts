import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: any;

  const workspaceId = 'ws-1';

  const mockPrismaService = {
    workspace: {
      findUnique: jest.fn(),
    },
    plan: {
      findMany: jest.fn(),
    },
    ticketStatus: {
      findMany: jest.fn(),
    },
    priority: {
      findMany: jest.fn(),
    },
    projectType: {
      findMany: jest.fn(),
    },
    hub: {
      findMany: jest.fn(),
    },
    userRole: {
      findMany: jest.fn(),
    },
    userPermission: {
      findMany: jest.fn(),
    },
    workspacePreference: {
      findUnique: jest.fn(),
    },
  };

  const workspace = {
    id: workspaceId,
    name: 'Acme',
    slug: 'acme',
    ownerId: 'user-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
  };

  const plans = [
    { id: 'plan-1', name: 'Starter', isActive: false, modules: [] },
    { id: 'plan-2', name: 'Pro', isActive: true, modules: [] },
  ];

  const ticketStatuses = [{ id: 'ts-1', name: 'New', order: 0 }];
  const priorities = [{ id: 'pr-1', name: 'Medium', order: 0 }];
  const projectTypes = [
    {
      id: 'pt-1',
      name: 'HubSpot',
      plans: [{ id: 'plan-2', name: 'Pro', isActive: true }],
    },
  ];
  const hubs = [{ id: 'hub-1', name: 'Marketing Hub', isActive: true }];
  const roles = [
    {
      id: 'role-1',
      name: 'Admin',
      isDefault: true,
      isSystem: true,
      rolePermissions: [
        { permission: { code: 'project.create' } },
        { permission: { code: 'comment.create' } },
      ],
    },
  ];
  const permissions = [
    { id: 'perm-1', code: 'project.create', description: 'Create projects' },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getSettings', () => {
    it('aggregates workspace configuration into a single settings payload', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue(workspace);
      mockPrismaService.plan.findMany.mockResolvedValue(plans);
      mockPrismaService.ticketStatus.findMany.mockResolvedValue(ticketStatuses);
      mockPrismaService.priority.findMany.mockResolvedValue(priorities);
      mockPrismaService.projectType.findMany.mockResolvedValue(projectTypes);
      mockPrismaService.hub.findMany.mockResolvedValue(hubs);
      mockPrismaService.userRole.findMany.mockResolvedValue(roles);
      mockPrismaService.userPermission.findMany.mockResolvedValue(permissions);
      mockPrismaService.workspacePreference.findUnique.mockResolvedValue(null);

      const result = await service.getSettings(workspaceId);

      expect(prisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          slug: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      expect(result).toEqual({
        workspace,
        activePlan: 'plan-2',
        plans,
        ticketStatuses,
        priorities,
        projectTypes,
        hubs,
        roles: [
          {
            id: 'role-1',
            name: 'Admin',
            isDefault: true,
            isSystem: true,
            permissions: ['comment.create', 'project.create'],
          },
        ],
        permissions,
        preferences: {
          allowManualTimeLog: true,
          allowPastTimeLog: false,
          pastTimeLogLimitValue: null,
          pastTimeLogLimitUnit: 'day',
        },
      });
    });

    it('returns activePlan null when no plan is active', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue(workspace);
      mockPrismaService.plan.findMany.mockResolvedValue([
        { id: 'plan-1', name: 'Starter', isActive: false, modules: [] },
      ]);
      mockPrismaService.ticketStatus.findMany.mockResolvedValue([]);
      mockPrismaService.priority.findMany.mockResolvedValue([]);
      mockPrismaService.projectType.findMany.mockResolvedValue([]);
      mockPrismaService.hub.findMany.mockResolvedValue([]);
      mockPrismaService.userRole.findMany.mockResolvedValue([]);
      mockPrismaService.userPermission.findMany.mockResolvedValue([]);
      mockPrismaService.workspacePreference.findUnique.mockResolvedValue(null);

      const result = await service.getSettings(workspaceId);

      expect(result.activePlan).toBeNull();
    });

    it('throws NotFoundException when the workspace does not exist', async () => {
      mockPrismaService.workspace.findUnique.mockResolvedValue(null);
      mockPrismaService.plan.findMany.mockResolvedValue([]);
      mockPrismaService.ticketStatus.findMany.mockResolvedValue([]);
      mockPrismaService.priority.findMany.mockResolvedValue([]);
      mockPrismaService.projectType.findMany.mockResolvedValue([]);
      mockPrismaService.hub.findMany.mockResolvedValue([]);
      mockPrismaService.userRole.findMany.mockResolvedValue([]);
      mockPrismaService.userPermission.findMany.mockResolvedValue([]);
      mockPrismaService.workspacePreference.findUnique.mockResolvedValue(null);

      await expect(service.getSettings(workspaceId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
