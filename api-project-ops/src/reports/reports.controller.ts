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
      'Project report: per-module work item usage, status/priority matrices, work type breakdown, overall progress',
  })
  get(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.reports.getProjectReport(workspaceId, projectId);
  }
}

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('reports')
export class WorkspaceReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({
    summary: 'Workspace-wide work item type and status breakdown',
  })
  getWorkspaceReport(
    @CurrentWorkspace() ws: { workspaceId: string; userId: string },
  ) {
    return this.reports.getWorkspaceReport(ws.workspaceId, ws.userId);
  }
}
