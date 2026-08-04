import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PERMISSIONS } from '../common/constants/permissions';
import {
  CurrentWorkspace,
  WorkspaceContext,
} from '../common/decorators/current-workspace.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { AttachmentsService } from './attachments.service';

/** Matches the frontend's own client-side check (use-project-attachments.ts). */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get('projects/:projectId/attachments')
  @RequirePermission(PERMISSIONS.ATTACHMENT_READ)
  @ApiOperation({ summary: 'List a project’s attachments' })
  list(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.attachments.list(workspaceId, projectId);
  }

  @Post('projects/:projectId/attachments')
  @RequirePermission(PERMISSIONS.ATTACHMENT_CREATE)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file to a project' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  create(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Query('inline') inline: string | undefined,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.attachments.create(
      ws.workspaceId,
      projectId,
      ws.userId,
      file,
      undefined,
      inline === 'true',
    );
  }

  @Get('projects/:projectId/work-items/:workItemId/attachments')
  @RequirePermission(PERMISSIONS.ATTACHMENT_READ)
  @ApiOperation({ summary: 'List a work item’s attachments' })
  listForWorkItem(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
  ) {
    return this.attachments.list(workspaceId, projectId, workItemId);
  }

  @Post('projects/:projectId/work-items/:workItemId/attachments')
  @RequirePermission(PERMISSIONS.ATTACHMENT_CREATE)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file to a work item' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_ATTACHMENT_BYTES } }),
  )
  createForWorkItem(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('workItemId') workItemId: string,
    @Query('inline') inline: string | undefined,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.attachments.create(
      ws.workspaceId,
      projectId,
      ws.userId,
      file,
      workItemId,
      inline === 'true',
    );
  }

  @Get('projects/:projectId/attachments/:id/download')
  @RequirePermission(PERMISSIONS.ATTACHMENT_READ)
  @ApiOperation({ summary: 'Download an attachment' })
  async download(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, attachment } = await this.attachments.download(
      workspaceId,
      projectId,
      id,
    );
    res.set({
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
    });
    return new StreamableFile(stream);
  }

  @Delete('projects/:projectId/attachments/:id')
  @RequirePermission(PERMISSIONS.ATTACHMENT_DELETE)
  @ApiOperation({ summary: 'Delete an attachment' })
  remove(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.attachments.remove(ws.workspaceId, projectId, id, ws.userId);
  }
}
