import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export const WORKSPACE_SLUG_HEADER = 'x-workspace-slug';

/**
 * Guards every workspace-scoped route. It resolves the active workspace from the
 * `x-workspace-slug` request header, then validates (against the DB) that the
 * authenticated caller is an active member of that workspace. On success it
 * publishes `request.workspace` for @CurrentWorkspace and tenant-scoped services.
 *
 * Switching workspaces is just changing the header — no token re-issue needed.
 *
 * Apply after the global JwtAuthGuard: `@UseGuards(WorkspaceScopeGuard)`.
 */
@Injectable()
export class WorkspaceScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;

    if (!user || user.type !== 'access') {
      throw new UnauthorizedException('Authentication required.');
    }

    const slug = this.extractSlug(request.headers[WORKSPACE_SLUG_HEADER]);
    if (!slug) {
      throw new BadRequestException(
        `Missing ${WORKSPACE_SLUG_HEADER} header. Select a workspace by passing its slug.`,
      );
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!workspace) {
      throw new NotFoundException(`Workspace "${slug}" not found.`);
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId: workspace.id,
        userId: user.sub,
        status: 'active',
      },
    });
    if (!membership) {
      throw new ForbiddenException(
        'You are not an active member of this workspace.',
      );
    }

    request.workspace = {
      workspaceId: workspace.id,
      roleId: membership.roleId,
      membershipId: membership.id,
      userId: user.sub,
    };

    return true;
  }

  private extractSlug(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) return value[0]?.trim() || null;
    return value?.trim() || null;
  }
}
