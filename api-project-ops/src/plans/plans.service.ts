import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Plan, Prisma } from '@prisma/client';
import { DEFAULT_MODULES } from '../common/constants/workspace-defaults';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new plan tier in the workspace. If `isActive` is set, all other
   * plans are deactivated first (single active plan per workspace). Defaults to
   * inactive so the invariant is never broken implicitly.
   */
  async createPlan(workspaceId: string, dto: CreatePlanDto) {
    const projectType = await this.prisma.projectType.findFirst({
      where: { id: dto.projectTypeId, workspaceId },
    });
    if (!projectType) {
      throw new BadRequestException('Project type not found in workspace');
    }

    const existing = await this.prisma.plan.findFirst({
      where: { projectTypeId: dto.projectTypeId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `A plan named "${dto.name}" already exists for this project type.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isActive) {
        await tx.plan.updateMany({
          where: { workspaceId, isActive: true },
          data: { isActive: false },
        });
      }
      const plan = await tx.plan.create({
        data: {
          workspaceId,
          projectTypeId: projectType.id,
          name: dto.name,
          maxProjects: dto.maxProjects ?? undefined,
          maxMembers: dto.maxMembers ?? undefined,
          maxTasksPerModule: dto.maxTasksPerModule ?? undefined,
          features: (dto.features ?? {}) as Prisma.InputJsonValue,
          isActive: dto.isActive ?? false,
        },
      });

      // Seed the default modules for the new plan.
      await tx.module.createMany({
        data: DEFAULT_MODULES.map((m) => ({
          workspaceId,
          planId: plan.id,
          key: m.key,
          name: m.name,
          defaultTaskLimit: m.defaultTaskLimit,
          isDefault: m.isDefault,
        })),
        skipDuplicates: true,
      });

      return plan;
    });
  }

  /** All active plans for a workspace (with their project type). */
  async getActivePlans(workspaceId: string) {
    return this.prisma.plan.findMany({
      where: { workspaceId, isActive: true },
      orderBy: { name: 'asc' },
      include: { projectType: { select: { id: true, name: true } } },
    });
  }

  /** The first active plan for a workspace. Throws 404 if none is active. */
  async getActivePlan(workspaceId: string): Promise<Plan> {
    const plan = await this.prisma.plan.findFirst({
      where: { workspaceId, isActive: true },
      orderBy: { id: 'asc' },
    });
    if (!plan) {
      throw new NotFoundException('No active plan for this workspace.');
    }
    return plan;
  }

  /** Fetch a specific plan in the workspace (throws 404 if missing). */
  async getPlan(workspaceId: string, planId?: string): Promise<Plan> {
    if (!planId) {
      return null;
    }
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, workspaceId },
    });
    if (!plan) {
      throw new NotFoundException('Plan not found in this workspace.');
    }
    return plan;
  }

  async listPlans(workspaceId: string, projectTypeId?: string) {
    return this.prisma.plan.findMany({
      where: { workspaceId, projectTypeId },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Switches the workspace's active plan: deactivates all others and activates
   * the chosen one (enforcing the single-active-plan invariant).
   */
  async activatePlan(workspaceId: string, planId: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, workspaceId },
    });
    if (!plan) {
      throw new NotFoundException('Plan not found in this workspace.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.plan.updateMany({
        where: { workspaceId, isActive: true },
        data: { isActive: false },
      });
      return tx.plan.update({
        where: { id: planId },
        data: { isActive: true },
      });
    });
  }

  /** Updates the active plan's limits / feature flags. */
  async updateActivePlan(workspaceId: string, dto: UpdatePlanDto) {
    const plan = await this.getActivePlan(workspaceId);
    return this.prisma.plan.update({
      where: { id: plan.id },
      data: {
        name: dto.name ?? undefined,
        maxProjects: dto.maxProjects ?? undefined,
        maxMembers: dto.maxMembers ?? undefined,
        maxTasksPerModule: dto.maxTasksPerModule ?? undefined,
        features:
          dto.features !== undefined
            ? (dto.features as Prisma.InputJsonValue)
            : undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
  }
}
