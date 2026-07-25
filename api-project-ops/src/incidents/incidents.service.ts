import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';

const REPORTER_SELECT = {
  select: { id: true, email: true, firstName: true, lastName: true },
} as const;

/**
 * Standalone incident tickets, scoped to a project (not bound to any task).
 */
@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Raise an incident ticket for an implementation flaw in the project. */
  async create(
    workspaceId: string,
    projectId: string,
    userId: string,
    dto: CreateIncidentDto,
  ) {
    await this.assertProject(workspaceId, projectId);

    return this.prisma.incident.create({
      data: {
        workspaceId,
        projectId,
        title: dto.title,
        description: dto.description,
        reportedBy: userId,
      },
      include: { reporter: REPORTER_SELECT },
    });
  }

  /** List the project's incident tickets. */
  async list(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);
    return this.prisma.incident.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: REPORTER_SELECT,
        _count: { select: { comments: true } },
      },
    });
  }

  /** Fetch one incident (with its comment count). */
  async findOne(workspaceId: string, projectId: string, incidentId: string) {
    await this.assertProject(workspaceId, projectId);
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, projectId },
      include: {
        reporter: REPORTER_SELECT,
        _count: { select: { comments: true } },
      },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    return incident;
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId, deletedAt: null },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
}
