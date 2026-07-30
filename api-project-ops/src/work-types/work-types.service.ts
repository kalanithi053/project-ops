import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkTypeDto } from './dto/create-work-type.dto';
import { UpdateWorkTypeDto } from './dto/update-work-type.dto';

@Injectable()
export class WorkTypesService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string) {
    return this.prisma.workType.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(workspaceId: string, id: string) {
    return this.getOwned(workspaceId, id);
  }

  async create(workspaceId: string, dto: CreateWorkTypeDto) {
    await this.assertNameFree(workspaceId, dto.name);
    return this.prisma.workType.create({
      data: {
        workspaceId,
        name: dto.name,
        color: dto.color,
        category: dto.category,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(workspaceId: string, id: string, dto: UpdateWorkTypeDto) {
    const workType = await this.getOwned(workspaceId, id);
    if (dto.name && dto.name !== workType.name) {
      await this.assertNameFree(workspaceId, dto.name);
    }
    return this.prisma.workType.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        color: dto.color ?? undefined,
        category: dto.category ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.getOwned(workspaceId, id);
    await this.prisma.workType.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async getOwned(workspaceId: string, id: string) {
    const workType = await this.prisma.workType.findFirst({
      where: { id, workspaceId },
    });
    if (!workType) throw new NotFoundException('Work type not found');
    return workType;
  }

  private async assertNameFree(workspaceId: string, name: string) {
    const existing = await this.prisma.workType.findFirst({
      where: { workspaceId, name },
    });
    if (existing) {
      throw new ConflictException(
        `A work type named "${name}" already exists.`,
      );
    }
  }
}
