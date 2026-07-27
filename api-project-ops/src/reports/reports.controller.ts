import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('projects/:projectId/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({
    summary:
      'Project report: per-module task usage, blocked/done/review counts, priority x status matrix, overall progress',
  })
  get(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.reports.getProjectReport(workspaceId, projectId);
  }
}
