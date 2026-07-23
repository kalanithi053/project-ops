import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketStatusDto } from './dto/create-ticket-status.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

@Injectable()
export class TicketStatusService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string) {
    return this.prisma.ticketStatus.findMany({
      where: { workspaceId },
      orderBy: { order: 'asc' },
    });
  }

  async create(workspaceId: string, dto: CreateTicketStatusDto) {
    await this.assertNameFree(workspaceId, dto.name);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await this.clearDefault(tx, workspaceId);
      return tx.ticketStatus.create({
        data: {
          workspaceId,
          name: dto.name,
          color: dto.color,
          order: dto.order ?? 0,
          category: dto.category,
          isDefault: dto.isDefault ?? false,
        },
      });
    });
  }

  async update(workspaceId: string, id: string, dto: UpdateTicketStatusDto) {
    const status = await this.getOwned(workspaceId, id);
    if (dto.name && dto.name !== status.name) {
      await this.assertNameFree(workspaceId, dto.name);
    }
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await this.clearDefault(tx, workspaceId);
      return tx.ticketStatus.update({
        where: { id },
        data: {
          name: dto.name ?? undefined,
          color: dto.color ?? undefined,
          order: dto.order ?? undefined,
          category: dto.category ?? undefined,
          isDefault: dto.isDefault ?? undefined,
        },
      });
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.getOwned(workspaceId, id);
    const taskCount = await this.prisma.task.count({ where: { statusId: id } });
    if (taskCount > 0) {
      throw new ConflictException(
        'Status is still used by tasks; reassign them first.',
      );
    }
    await this.prisma.ticketStatus.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async getOwned(workspaceId: string, id: string) {
    const status = await this.prisma.ticketStatus.findFirst({
      where: { id, workspaceId },
    });
    if (!status) throw new NotFoundException('Ticket status not found');
    return status;
  }

  private async assertNameFree(workspaceId: string, name: string) {
    const existing = await this.prisma.ticketStatus.findFirst({
      where: { workspaceId, name },
    });
    if (existing) {
      throw new ConflictException(`A status named "${name}" already exists.`);
    }
  }

  private async clearDefault(tx: Prisma.TransactionClient, workspaceId: string) {
    await tx.ticketStatus.updateMany({
      where: { workspaceId, isDefault: true },
      data: { isDefault: false },
    });
  }
}
