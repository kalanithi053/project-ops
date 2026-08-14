import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import {
  CurrentWorkspace,
  WorkspaceContext,
} from '../common/decorators/current-workspace.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { WorkItemsService } from './work-items.service';
import { CreateWorkItemDto } from './dto/create-work-item.dto';
import { UpdateWorkItemDto } from './dto/update-work-item.dto';
import { ListWorkItemsQueryDto } from './dto/list-work-items.dto';

@ApiTags('work-items')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('work-items')
export class WorkspaceWorkItemsController {
  constructor(private readonly workItems: WorkItemsService) {}

  @Get('attention')
  @RequirePermission(PERMISSIONS.WORKITEM_READ)
  @ApiOperation({
    summary:
      "The caller's own work items needing attention: overdue, due soon, or blocked, with due dates",
  })
  getAttentionItems(@CurrentWorkspace() ws: WorkspaceContext) {
    return this.workItems.getAttentionItems(ws.workspaceId, ws.userId);
  }

  @Get('priority')
  @RequirePermission(PERMISSIONS.WORKITEM_READ)
  @ApiOperation({
    summary:
      "The caller's own open work items ranked by priority, for the dashboard",
  })
  getPriorityItems(@CurrentWorkspace() ws: WorkspaceContext) {
    return this.workItems.getPriorityItems(ws.workspaceId, ws.userId);
  }

  @Get('mine')
  @RequirePermission(PERMISSIONS.WORKITEM_READ)
  @ApiOperation({
    summary:
      "Every open work item assigned to the caller, for the dashboard's quick time-log picker",
  })
  getMyOpenItems(@CurrentWorkspace() ws: WorkspaceContext) {
    return this.workItems.getMyOpenItems(ws.workspaceId, ws.userId);
  }

  @Get('attention/team')
  @RequirePermission(PERMISSIONS.WORKITEM_READ)
  @ApiOperation({
    summary:
      'Every work item in the workspace needing attention, across every assignee — Owner/Admin/Client only',
  })
  getTeamAttentionItems(@CurrentWorkspace() ws: WorkspaceContext) {
    this.assertManagerRole(ws.isManagerTier);
    return this.workItems.getTeamAttentionItems(ws.workspaceId);
  }

  @Get('priority/team')
  @RequirePermission(PERMISSIONS.WORKITEM_READ)
  @ApiOperation({
    summary:
      'Every open work item in the workspace ranked by priority, across every assignee — Owner/Admin/Client only',
  })
  getTeamPriorityItems(@CurrentWorkspace() ws: WorkspaceContext) {
    this.assertManagerRole(ws.isManagerTier);
    return this.workItems.getTeamPriorityItems(ws.workspaceId);
  }

  private assertManagerRole(isManagerTier: boolean) {
    assertManagerRole(isManagerTier);
  }
}

/** Shared by both controllers below — see WorkspaceWorkItemsController.assertManagerRole. */
function assertManagerRole(isManagerTier: boolean) {
  if (!isManagerTier) {
    throw new ForbiddenException(
      'Your role is not set up for workspace-wide work items — enable it in Settings > Roles.',
    );
  }
}

@ApiTags('work-items')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('projects/:projectId/work-items')
export class WorkItemsController {
  constructor(private readonly workItems: WorkItemsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.WORKITEM_READ)
  @ApiOperation({ summary: 'List work items in a project' })
  list(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query() query: ListWorkItemsQueryDto,
  ) {
    return this.workItems.list(workspaceId, projectId, query);
  }

  @Post()
  @RequirePermission(PERMISSIONS.WORKITEM_CREATE)
  @ApiOperation({ summary: 'Create a work item' })
  create(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkItemDto,
  ) {
    return this.workItems.create(ws.workspaceId, projectId, ws.userId, dto);
  }

  @Get('attention')
  @RequirePermission(PERMISSIONS.WORKITEM_READ)
  @ApiOperation({
    summary:
      'Every work item in this project needing attention, across every assignee — Owner/Admin/Client only',
  })
  getProjectAttentionItems(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
  ) {
    assertManagerRole(ws.isManagerTier);
    return this.workItems.getTeamAttentionItems(ws.workspaceId, projectId);
  }

  @Get('priority')
  @RequirePermission(PERMISSIONS.WORKITEM_READ)
  @ApiOperation({
    summary:
      'Every open work item in this project ranked by priority, across every assignee — Owner/Admin/Client only',
  })
  getProjectPriorityItems(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
  ) {
    assertManagerRole(ws.isManagerTier);
    return this.workItems.getTeamPriorityItems(ws.workspaceId, projectId);
  }

  @Get(':workItemId')
  @RequirePermission(PERMISSIONS.WORKITEM_READ)
  @ApiOperation({ summary: 'Get a work item' })
  findOne(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
  ) {
    return this.workItems.findOne(workspaceId, projectId, workItemId);
  }

  @Patch(':workItemId')
  @RequirePermission(PERMISSIONS.WORKITEM_UPDATE)
  @ApiOperation({ summary: 'Update a work item' })
  update(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
    @Body() dto: UpdateWorkItemDto,
  ) {
    return this.workItems.update(
      ws.workspaceId,
      projectId,
      workItemId,
      ws.userId,
      dto,
    );
  }

  @Delete(':workItemId')
  @RequirePermission(PERMISSIONS.WORKITEM_DELETE)
  @ApiOperation({ summary: 'Delete a work item' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
  ) {
    return this.workItems.remove(workspaceId, projectId, workItemId);
  }

  @Get(':workItemId/activity')
  @RequirePermission(PERMISSIONS.WORKITEM_READ)
  @ApiOperation({ summary: "Get a work item's activity log" })
  getActivity(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
  ) {
    return this.workItems.getActivity(workspaceId, projectId, workItemId);
  }

  @Post(':workItemId/notify')
  @RequirePermission(PERMISSIONS.WORKITEM_READ)
  @ApiOperation({
    summary: 'Email the assignee a reminder about this work item',
  })
  notifyAssignee(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
  ) {
    return this.workItems.notifyAssignee(workspaceId, projectId, workItemId);
  }
}
