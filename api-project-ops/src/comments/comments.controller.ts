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

  @Get('comments')
  @ApiOperation({ summary: 'List comments in the workspace' })
  list(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.comments.list(workspaceId);
  }

  @Post('comments')
  @RequirePermission(PERMISSIONS.COMMENT_CREATE)
  @ApiOperation({
    summary: 'Create a comment (tag workspace members via mentions: [emails])',
  })
  create(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(ws.workspaceId, ws.userId, dto);
  }

  @Patch('comments/:commentId')
  @RequirePermission(PERMISSIONS.COMMENT_CREATE)
  @ApiOperation({ summary: 'Edit your own comment' })
  update(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('commentId') commentId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.update(ws.workspaceId, commentId, ws.userId, dto);
  }

  @Delete('comments/:commentId')
  @RequirePermission(PERMISSIONS.COMMENT_CREATE)
  @ApiOperation({ summary: 'Delete your own comment' })
  remove(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('commentId') commentId: string,
  ) {
    return this.comments.remove(ws.workspaceId, commentId, ws.userId);
  }

  @Get('projects/:projectId/work-items/:workItemId/comments')
  @RequirePermission(PERMISSIONS.WORKITEM_READ)
  @ApiOperation({ summary: 'List comments on a work item' })
  listWorkItemComments(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
  ) {
    return this.comments.listForWorkItem(workspaceId, projectId, workItemId);
  }

  @Post('projects/:projectId/work-items/:workItemId/comments')
  @RequirePermission(PERMISSIONS.COMMENT_CREATE)
  @ApiOperation({
    summary:
      'Comment on a work item (tag workspace members via mentions: [emails])',
  })
  createWorkItemComment(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.createForWorkItem(
      ws.workspaceId,
      projectId,
      workItemId,
      ws.userId,
      dto,
    );
  }

  @Patch('projects/:projectId/work-items/:workItemId/comments/:commentId')
  @RequirePermission(PERMISSIONS.COMMENT_CREATE)
  @ApiOperation({ summary: 'Edit your own work item comment' })
  updateWorkItemComment(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
    @Param('commentId') commentId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.updateForWorkItem(
      ws.workspaceId,
      projectId,
      workItemId,
      commentId,
      ws.userId,
      dto,
    );
  }

  @Delete('projects/:projectId/work-items/:workItemId/comments/:commentId')
  @RequirePermission(PERMISSIONS.COMMENT_CREATE)
  @ApiOperation({ summary: 'Delete your own work item comment' })
  removeWorkItemComment(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.comments.removeForWorkItem(
      ws.workspaceId,
      projectId,
      workItemId,
      commentId,
      ws.userId,
    );
  }
}
