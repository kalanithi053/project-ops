import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SearchResultType = 'project' | 'workitem' | 'member';

export interface SearchResultItem {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string | null;
  /** Only set for a 'workitem' result — the project it belongs to, for building its URL. */
  projectId?: string;
}

export interface GlobalSearchResult {
  projects: SearchResultItem[];
  workItems: SearchResultItem[];
  members: SearchResultItem[];
}

const DEFAULT_LIMIT = 5;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Searches Projects, WorkItems, and WorkspaceMembers within a single
   * workspace. Non-manager-tier callers only see projects (and their work
   * items) they're a ProjectMember of, mirroring ProjectsService.list() —
   * a workspace-level "can read projects" permission doesn't by itself mean
   * the caller can see every project in the workspace.
   */
  async search(
    workspaceId: string,
    userId: string,
    isManagerTier: boolean,
    term: string,
    limit = DEFAULT_LIMIT,
  ): Promise<GlobalSearchResult> {
    const query = term.trim();
    if (!query) {
      return { projects: [], workItems: [], members: [] };
    }

    const projectVisibility = isManagerTier
      ? {}
      : { members: { some: { userId, status: { not: 'removed' as const } } } };

    const [projects, workItems, members] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          name: { contains: query, mode: 'insensitive' },
          ...projectVisibility,
        },
        select: {
          id: true,
          name: true,
          projectType: { select: { name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      this.prisma.workItem.findMany({
        where: {
          project: { workspaceId, deletedAt: null, ...projectVisibility },
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { prefix: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          prefix: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
      }),
      this.prisma.workspaceMember.findMany({
        where: {
          workspaceId,
          status: 'active',
          user: {
            OR: [
              { firstName: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { email: { contains: query, mode: 'insensitive' } },
            ],
          },
        },
        select: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        take: limit,
      }),
    ]);

    return {
      projects: projects.map((project) => ({
        type: 'project' as const,
        id: project.id,
        title: project.name,
        subtitle: project.projectType?.name ?? null,
      })),
      workItems: workItems.map((workItem) => ({
        type: 'workitem' as const,
        id: workItem.id,
        title: workItem.name,
        subtitle: workItem.prefix ?? workItem.project.name,
        projectId: workItem.project.id,
      })),
      members: members.map(({ user }) => ({
        type: 'member' as const,
        id: user.id,
        title:
          [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
          user.email,
        subtitle: user.email,
      })),
    };
  }
}
