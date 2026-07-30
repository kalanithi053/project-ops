import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PERMISSIONS } from '../common/constants/permissions';
import {
  CurrentWorkspace,
  WorkspaceContext,
} from '../common/decorators/current-workspace.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { TimeLogsService } from './time-logs.service';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { UpdateTimeLogDto } from './dto/update-time-log.dto';
import { ListTimeLogsDto } from './dto/list-time-logs.dto';
import { StopTimerDto } from './dto/stop-timer.dto';

@ApiTags('time-logs')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller()
export class TimeLogsController {
  constructor(private readonly timeLogs: TimeLogsService) {}

  @Get('time-logs/running')
  @RequirePermission(PERMISSIONS.TIMELOG_READ)
  @ApiOperation({
    summary: "Get the caller's running timer, if any, across every work item",
  })
  getMyRunningTimer(@CurrentWorkspace('userId') userId: string) {
    return this.timeLogs.getMyRunningTimer(userId);
  }

  @Get('projects/:projectId/work-items/:workItemId/time-logs')
  @RequirePermission(PERMISSIONS.TIMELOG_READ)
  @ApiOperation({
    summary: "List time logs for a work item, plus the caller's running timer",
  })
  listForWorkItem(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
  ) {
    return this.timeLogs.listForWorkItem(
      ws.workspaceId,
      projectId,
      workItemId,
      ws.userId,
    );
  }

  @Post('projects/:projectId/work-items/:workItemId/time-logs')
  @RequirePermission(PERMISSIONS.TIMELOG_MANAGE)
  @ApiOperation({ summary: 'Log time manually (assignee only)' })
  create(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
    @Body() dto: CreateTimeLogDto,
  ) {
    return this.timeLogs.create(
      ws.workspaceId,
      projectId,
      workItemId,
      ws.userId,
      dto,
    );
  }

  @Post('projects/:projectId/work-items/:workItemId/time-logs/timer/start')
  @RequirePermission(PERMISSIONS.TIMELOG_MANAGE)
  @ApiOperation({ summary: 'Start a timer on this work item (assignee only)' })
  startTimer(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
  ) {
    return this.timeLogs.startTimer(
      ws.workspaceId,
      projectId,
      workItemId,
      ws.userId,
    );
  }

  @Post('projects/:projectId/work-items/:workItemId/time-logs/timer/stop')
  @RequirePermission(PERMISSIONS.TIMELOG_MANAGE)
  @ApiOperation({
    summary: "Stop the caller's running timer on this work item",
  })
  stopTimer(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
    @Body() dto: StopTimerDto,
  ) {
    return this.timeLogs.stopTimer(
      ws.workspaceId,
      projectId,
      workItemId,
      ws.userId,
      dto.notes,
    );
  }

  @Get('projects/:projectId/time-logs')
  @RequirePermission(PERMISSIONS.TIMELOG_READ)
  @ApiOperation({
    summary: 'List time logs across the project, filterable by date range/user',
  })
  listForProject(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: ListTimeLogsDto,
  ) {
    return this.timeLogs.listForProject(workspaceId, projectId, query);
  }

  @Get('projects/:projectId/time-logs/export')
  @RequirePermission(PERMISSIONS.TIMELOG_READ)
  @ApiOperation({ summary: 'Download the filtered time logs as CSV' })
  async exportCsv(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: ListTimeLogsDto,
    @Res() res: Response,
  ) {
    const csv = await this.timeLogs.exportCsv(workspaceId, projectId, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="time-logs-${projectId}.csv"`,
    );
    res.send(csv);
  }

  @Patch('time-logs/:id')
  @RequirePermission(PERMISSIONS.TIMELOG_MANAGE)
  @ApiOperation({ summary: 'Edit your own time log entry' })
  update(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('id') id: string,
    @Body() dto: UpdateTimeLogDto,
  ) {
    return this.timeLogs.update(id, ws.userId, dto);
  }

  @Delete('time-logs/:id')
  @RequirePermission(PERMISSIONS.TIMELOG_MANAGE)
  @ApiOperation({ summary: 'Delete your own time log entry' })
  remove(@CurrentWorkspace() ws: WorkspaceContext, @Param('id') id: string) {
    return this.timeLogs.remove(id, ws.userId);
  }
}
