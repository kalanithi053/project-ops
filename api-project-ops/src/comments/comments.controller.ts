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

  @Patch('projects/:projectId/tasks/:taskId/comments/:commentId')
  @RequirePermission(PERMISSIONS.COMMENT_CREATE)
  @ApiOperation({ summary: 'Edit your own task comment' })
  updateTaskComment(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.updateForTask(
      ws.workspaceId,
      projectId,
      taskId,
      commentId,
      ws.userId,
      dto,
    );
  }

  @Delete('projects/:projectId/tasks/:taskId/comments/:commentId')
  @RequirePermission(PERMISSIONS.COMMENT_CREATE)
  @ApiOperation({ summary: 'Delete your own task comment' })
  removeTaskComment(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.comments.removeForTask(
      ws.workspaceId,
      projectId,
      taskId,
      commentId,
      ws.userId,
    );
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

  @Patch('projects/:projectId/incidents/:incidentId/comments/:commentId')
  @RequirePermission(PERMISSIONS.COMMENT_CREATE)
  @ApiOperation({ summary: 'Edit your own incident comment' })
  updateIncidentComment(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('incidentId') incidentId: string,
    @Param('commentId') commentId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.updateForIncident(
      ws.workspaceId,
      projectId,
      incidentId,
      commentId,
      ws.userId,
      dto,
    );
  }

  @Delete('projects/:projectId/incidents/:incidentId/comments/:commentId')
  @RequirePermission(PERMISSIONS.COMMENT_CREATE)
  @ApiOperation({ summary: 'Delete your own incident comment' })
  removeIncidentComment(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('incidentId') incidentId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.comments.removeForIncident(
      ws.workspaceId,
      projectId,
      incidentId,
      commentId,
      ws.userId,
    );
  }
}
