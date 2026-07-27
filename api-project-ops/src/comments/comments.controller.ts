import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../common/constants/permissions';
import {
  CurrentWorkspace,
  WorkspaceContext,
} from '../common/decorators/current-workspace.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post('projects/:projectId/tasks/:taskId/comments')
  @RequirePermission(PERMISSIONS.COMMENT_CREATE)
  @ApiOperation({
    summary: 'Comment on a task (tag workspace members via mentions: [emails])',
  })
  createTaskComment(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.createForTask(
      ws.workspaceId,
      projectId,
      taskId,
      ws.userId,
      dto,
    );
  }

  @Get('projects/:projectId/tasks/:taskId/comments')
  @RequirePermission(PERMISSIONS.TASK_READ)
  @ApiOperation({ summary: 'List comments on a task' })
  listTaskComments(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.comments.listForTask(workspaceId, projectId, taskId);
  }

  @Post('projects/:projectId/incidents/:incidentId/comments')
  @RequirePermission(PERMISSIONS.COMMENT_CREATE)
  @ApiOperation({
    summary:
      'Comment on an incident ticket (tag workspace members via mentions: [emails])',
  })
  createIncidentComment(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('incidentId') incidentId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.createForIncident(
      ws.workspaceId,
      projectId,
      incidentId,
      ws.userId,
      dto,
    );
  }

  @Get('projects/:projectId/incidents/:incidentId/comments')
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ summary: 'List comments on an incident ticket' })
  listIncidentComments(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('incidentId') incidentId: string,
  ) {
    return this.comments.listForIncident(workspaceId, projectId, incidentId);
  }
}
