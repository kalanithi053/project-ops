import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
  ) {
    return this.workItems.list(workspaceId, projectId);
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
