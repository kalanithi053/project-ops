import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { AttachmentsService } from './attachments.service';
import { MAX_FILE_BYTES, attachmentStorage } from './upload.config';

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('projects/:projectId/tasks/:taskId/attachments')
export class TaskAttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.TASK_READ)
  @ApiOperation({ summary: 'List documents attached to a task' })
  list(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.attachments.listForTask(workspaceId, projectId, taskId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.TASK_UPDATE)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Attach a document to a task (max 10 MB)' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: attachmentStorage,
      limits: { fileSize: MAX_FILE_BYTES },
    }),
  )
  upload(
    @CurrentWorkspace() ws: { workspaceId: string; userId: string },
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file was uploaded.');
    return this.attachments.create(
      ws.workspaceId,
      projectId,
      taskId,
      ws.userId,
      file,
    );
  }

  /**
   * Streams the file back under its original name.
   *
   * Downloads go through the API rather than a static /uploads mount so they
   * stay behind the same auth and workspace scoping as everything else — a
   * public folder would make every attachment readable to anyone who could
   * guess a filename.
   *
   * Uses `@Res()` directly, which takes the response out of the global
   * ResponseInterceptor's hands — a streamed file must not be wrapped in the
   * JSON envelope.
   */
  @Get(':attachmentId/download')
  @RequirePermission(PERMISSIONS.TASK_READ)
  @ApiOperation({ summary: 'Download an attachment' })
  async download(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const file = await this.attachments.resolveForDownload(
      workspaceId,
      projectId,
      taskId,
      attachmentId,
    );
    res.type(file.mimeType);
    res.download(file.path, file.fileName);
  }

  @Delete(':attachmentId')
  @RequirePermission(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Remove an attachment' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.attachments.remove(
      workspaceId,
      projectId,
      taskId,
      attachmentId,
    );
  }
}

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('projects/:projectId/attachments')
export class ProjectAttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ summary: 'Every document attached across a project' })
  list(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.attachments.listForProject(workspaceId, projectId);
  }
}
