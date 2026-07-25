import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { ActivityLogService } from './activity-log.service';

@ApiTags('activity-log')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('activity')
export class ActivityLogController {
  constructor(private readonly activityLog: ActivityLogService) {}

  @Get(':entityId')
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({
    summary:
      "Get an entity's activity timeline by id (task or incident, whichever it is)",
  })
  getTimeline(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('entityId') entityId: string,
  ) {
    return this.activityLog.getTimeline(workspaceId, entityId);
  }
}
