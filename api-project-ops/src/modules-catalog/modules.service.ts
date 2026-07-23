import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

/** CRUD over the per-workspace module catalog. */
@Injectable()
export class ModulesService {
  constructor(private readonly prisma: PrismaService) {}

  list(workspaceId: string) {
    return this.prisma.module.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
    });
  }

  async create(workspaceId: string, dto: CreateModuleDto) {
    const existing = await this.prisma.module.findFirst({
      where: { workspaceId, key: dto.key },
    });
    if (existing) {
      throw new ConflictException(`A module with key "${dto.key}" already exists.`);
    }
    return this.prisma.module.create({
      data: {
        workspaceId,
        key: dto.key,
        name: dto.name,
        defaultTaskLimit: dto.defaultTaskLimit ?? 10,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(workspaceId: string, id: string, dto: UpdateModuleDto) {
    await this.getOwned(workspaceId, id);
    return this.prisma.module.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        defaultTaskLimit: dto.defaultTaskLimit ?? undefined,
        isDefault: dto.isDefault ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
  }

  async remove(workspaceId: string, id: string) {
    await this.getOwned(workspaceId, id);
    const instances = await this.prisma.moduleInstance.count({
      where: { moduleId: id },
    });
    if (instances > 0) {
      throw new ConflictException(
        'Module is attached to projects; detach it first.',
      );
    }
    await this.prisma.module.delete({ where: { id } });
    return { id, deleted: true };
  }

  private async getOwned(workspaceId: string, id: string) {
    const module = await this.prisma.module.findFirst({
      where: { id, workspaceId },
    });
    if (!module) throw new NotFoundException('Module not found');
    return module;
  }
}
