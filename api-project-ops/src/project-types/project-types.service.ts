import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { PLAN_TEMPLATES } from '../common/constants/workspace-defaults';
import { CreateProjectTypeDto } from './dto/create-project-type.dto';
import { UpdateProjectTypeDto } from './dto/update-project-type.dto';

@Injectable()
export class ProjectTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  list(workspaceId: string) {
    return this.prisma.projectType.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
      include: {
        plans: { select: { id: true, name: true, isActive: true } },
      },
    });
  }

  async create(workspaceId: string, dto: CreateProjectTypeDto) {
    await this.assertNameFree(workspaceId, dto.name);

    const projectType = await this.prisma.projectType.create({
      data: {
        workspaceId,
        name: dto.name,
        color: dto.color,
        description: dto.description,
        isPlanAdd: dto.isPlanAdd ?? true,
      },
    });

    // For plan-adding types, seed the default plans (each of which seeds its own
    // default modules). Created inactive so the workspace's active plan is
    // untouched.
    if (projectType.isPlanAdd) {
      for (const template of PLAN_TEMPLATES) {
        await this.plans.createPlan(workspaceId, {
          projectTypeId: projectType.id,
          name: template.name,
          features: template.features,
          isActive: false,
        });
      }
    }

    return projectType;
  }

  async update(workspaceId: string, id: string, dto: UpdateProjectTypeDto) {
    const type = await this.getOwned(workspaceId, id);
    if (dto.name && dto.name !== type.name) {
      await this.assertNameFree(workspaceId, dto.name);
    }

    return this.prisma.projectType.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        color: dto.color ?? undefined,
        description: dto.description ?? undefined,
        isPlanAdd: dto.isPlanAdd ?? undefined,
      },
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.getOwned(workspaceId, id);
    const inUse = await this.prisma.project.count({
      where: { projectTypeId: id, deletedAt: null },
    });
    if (inUse > 0) {
      throw new ConflictException(
        'Project type is in use by projects; reassign them first.',
      );
    }
    await this.prisma.projectType.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async getOwned(workspaceId: string, id: string) {
    const type = await this.prisma.projectType.findFirst({
      where: { id, workspaceId },
    });
    if (!type) throw new NotFoundException('Project type not found');
    return type;
  }

  private async assertNameFree(workspaceId: string, name: string) {
    const existing = await this.prisma.projectType.findFirst({
      where: { workspaceId, name },
    });
    if (existing) {
      throw new ConflictException(
        `A project type named "${name}" already exists.`,
      );
    }
  }
}
