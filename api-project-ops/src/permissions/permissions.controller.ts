import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { PERMISSIONS } from '../common/constants/permissions';

@ApiTags('permissions')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PERMISSION_READ)
  @ApiOperation({ summary: 'List the workspace permission catalog' })
  list(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.prisma.userPermission.findMany({
      where: { workspaceId },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, description: true },
    });
  }
}
