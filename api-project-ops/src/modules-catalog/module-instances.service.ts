import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttachModuleDto } from './dto/attach-module.dto';
import { UpdateModuleInstanceDto } from './dto/update-module-instance.dto';

/** Manages module instances attached to a specific project. */
@Injectable()
export class ModuleInstancesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.moduleInstance.findMany({
      where: { projectId },
      include: { module: { select: { key: true, name: true } } },
    });
  }

  async attach(workspaceId: string, projectId: string, dto: AttachModuleDto) {
    await this.assertProject(workspaceId, projectId);

    const module = await this.prisma.module.findFirst({
      where: { id: dto.moduleId, workspaceId },
    });
    if (!module) throw new NotFoundException('Module not found in workspace');

    const existing = await this.prisma.moduleInstance.findFirst({
      where: { projectId, moduleId: dto.moduleId },
    });
    if (existing) {
      throw new ConflictException('Module already attached to this project.');
    }

    return this.prisma.moduleInstance.create({
      data: {
        projectId,
        moduleId: dto.moduleId,
        taskLimit: dto.taskLimit ?? module.defaultTaskLimit,
      },
    });
  }

  async update(
    workspaceId: string,
    projectId: string,
    instanceId: string,
    dto: UpdateModuleInstanceDto,
  ) {
    await this.getInstance(workspaceId, projectId, instanceId);

    return this.prisma.moduleInstance.update({
      where: { id: instanceId },
      data: { taskLimit: dto.taskLimit },
    });
  }

  async remove(workspaceId: string, projectId: string, instanceId: string) {
    await this.getInstance(workspaceId, projectId, instanceId);
    await this.prisma.moduleInstance.delete({ where: { id: instanceId } });
    return { id: instanceId, deleted: true };
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async getInstance(
    workspaceId: string,
    projectId: string,
    instanceId: string,
  ) {
    await this.assertProject(workspaceId, projectId);
    const instance = await this.prisma.moduleInstance.findFirst({
      where: { id: instanceId, projectId },
    });
    if (!instance) throw new NotFoundException('Module instance not found');
    return instance;
  }
}
