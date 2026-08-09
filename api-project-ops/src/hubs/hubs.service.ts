import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HUB_TIERS } from '../common/constants/workspace-defaults';
import { CreateHubDto } from './dto/create-hub.dto';
import { UpdateHubDto } from './dto/update-hub.dto';

@Injectable()
export class HubsService {
  constructor(private readonly prisma: PrismaService) {}

  async listHubs(workspaceId: string, projectTypeId?: string) {
    if (!projectTypeId) {
      throw new BadRequestException('project Type Id is required');
    }
    return this.prisma.hub.findMany({
      where: { workspaceId, projectTypeId },
      orderBy: { name: 'asc' },
    });
  }

  async createHub(workspaceId: string, dto: CreateHubDto) {
    const projectType = await this.prisma.projectType.findFirst({
      where: { id: dto.projectTypeId, workspaceId },
    });
    if (!projectType) {
      throw new BadRequestException('Project type not found in workspace');
    }
    await this.assertNameFree(dto.projectTypeId, dto.name);

    return this.prisma.$transaction(async (tx) => {
      const hub = await tx.hub.create({
        data: {
          workspaceId,
          projectTypeId: dto.projectTypeId,
          name: dto.name,
          color: dto.color,
          isActive: dto.isActive ?? true,
        },
      });

      // Seed the hub's tiers as empty plans — admin adds modules afterward,
      // same as a fresh plan-adding project type seeding PLAN_TEMPLATES.
      await tx.plan.createMany({
        data: HUB_TIERS.map((tier) => ({
          workspaceId,
          projectTypeId: dto.projectTypeId,
          hubId: hub.id,
          name: tier,
          isActive: false,
        })),
      });

      return hub;
    });
  }

  async updateHub(workspaceId: string, hubId: string, dto: UpdateHubDto) {
    const hub = await this.getOwned(workspaceId, hubId);
    if (dto.name && dto.name !== hub.name) {
      await this.assertNameFree(hub.projectTypeId, dto.name);
    }

    return this.prisma.hub.update({
      where: { id: hubId },
      data: {
        name: dto.name ?? undefined,
        color: dto.color ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
  }

  async deleteHub(workspaceId: string, hubId: string) {
    await this.getOwned(workspaceId, hubId);
    const inUse = await this.prisma.project.count({
      where: { hubId: { has: hubId }, deletedAt: null },
    });
    if (inUse > 0) {
      throw new ConflictException(
        'Hub is in use by projects; reassign them first.',
      );
    }
    await this.prisma.hub.delete({ where: { id: hubId } });
    return { id: hubId, deleted: true };
  }

  private async getOwned(workspaceId: string, id: string) {
    const hub = await this.prisma.hub.findFirst({
      where: { id, workspaceId },
    });
    if (!hub) throw new NotFoundException('Hub not found');
    return hub;
  }

  private async assertNameFree(projectTypeId: string, name: string) {
    const existing = await this.prisma.hub.findFirst({
      where: { projectTypeId, name },
    });
    if (existing) {
      throw new ConflictException(`A hub named "${name}" already exists.`);
    }
  }
}
