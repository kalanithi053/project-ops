import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { provisionWorkspaceDefaults } from './workspace-provisioning';

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a workspace and, in one transaction, provisions its default roles,
   * permissions, modules, ticket statuses and Free plan, then adds the creator
   * as an active Owner member.
   */
  async create(userId: string, dto: CreateWorkspaceDto) {
    const slug = await this.buildUniqueSlug(dto.slug ?? dto.name);

    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name: dto.name, slug, ownerId: userId },
      });

      const { ownerRoleId } = await provisionWorkspaceDefaults(tx, workspace.id);

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          roleId: ownerRoleId,
          status: 'active',
        },
      });

      return workspace;
    });
  }

  /** GET /workspaces/me — all workspaces the user belongs to, with their role. */
  async listForUser(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId, status: { not: 'removed' } },
      include: {
        workspace: true,
        role: { select: { id: true, name: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      status: m.status,
      role: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  /** Fetch a single workspace the user is a member of. */
  async findOneForUser(userId: string, workspaceId: string) {
    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId, status: { not: 'removed' } },
      include: { workspace: true, role: true },
    });
    if (!membership) {
      throw new NotFoundException('Workspace not found or access denied.');
    }
    return {
      ...membership.workspace,
      role: { id: membership.role.id, name: membership.role.name },
    };
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  private async buildUniqueSlug(source: string): Promise<string> {
    const base = this.slugify(source) || 'workspace';
    let candidate = base;
    let suffix = 1;
    while (await this.prisma.workspace.findUnique({ where: { slug: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }
}
