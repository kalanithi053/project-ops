import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePriorityDto } from './dto/create-priority.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';

@Injectable()
export class PrioritiesService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string) {
    return this.prisma.priority.findMany({
      where: { workspaceId },
      orderBy: { order: 'asc' },
    });
  }

  async create(workspaceId: string, dto: CreatePriorityDto) {
    await this.assertNameFree(workspaceId, dto.name);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await this.clearDefault(tx, workspaceId);
      return tx.priority.create({
        data: {
          workspaceId,
          name: dto.name,
          color: dto.color,
          order: dto.order ?? 0,
          isDefault: dto.isDefault ?? false,
        },
      });
    });
  }

  async update(workspaceId: string, id: string, dto: UpdatePriorityDto) {
    const priority = await this.getOwned(workspaceId, id);
    if (dto.name && dto.name !== priority.name) {
      await this.assertNameFree(workspaceId, dto.name);
    }
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await this.clearDefault(tx, workspaceId);
      return tx.priority.update({
        where: { id },
        data: {
          name: dto.name ?? undefined,
          color: dto.color ?? undefined,
          order: dto.order ?? undefined,
          isDefault: dto.isDefault ?? undefined,
        },
      });
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.getOwned(workspaceId, id);
    const workItemCount = await this.prisma.workItem.count({
      where: { priorityId: id },
    });
    if (workItemCount > 0) {
      throw new ConflictException(
        'Priority is still used by work items; reassign them first.',
      );
    }
    await this.prisma.priority.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async getOwned(workspaceId: string, id: string) {
    const priority = await this.prisma.priority.findFirst({
      where: { id, workspaceId },
    });
    if (!priority) throw new NotFoundException('Priority not found');
    return priority;
  }

  private async assertNameFree(workspaceId: string, name: string) {
    const existing = await this.prisma.priority.findFirst({
      where: { workspaceId, name },
    });
    if (existing) {
      throw new ConflictException(`A priority named "${name}" already exists.`);
    }
  }

  private async clearDefault(
    tx: Prisma.TransactionClient,
    workspaceId: string,
  ) {
    await tx.priority.updateMany({
      where: { workspaceId, isDefault: true },
      data: { isDefault: false },
    });
  }
}
