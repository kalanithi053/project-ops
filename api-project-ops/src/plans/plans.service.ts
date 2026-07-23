import { Injectable, NotFoundException } from '@nestjs/common';
import { Plan, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** The single active plan for a workspace. Throws 404 if none is active. */
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

  async listPlans(workspaceId: string) {
    return this.prisma.plan.findMany({ where: { workspaceId } });
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
