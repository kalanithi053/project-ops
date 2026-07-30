import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import {
  CurrentWorkspace,
  WorkspaceContext,
} from '../common/decorators/current-workspace.decorator';
import { AccessService } from './access.service';

@ApiTags('access')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard)
@Controller()
export class AccessController {
  constructor(private readonly access: AccessService) {}

  @Get('workspace/permission')
  @ApiOperation({
    summary: 'Permissions allowed to the current user in the active workspace',
  })
  workspacePermission(@CurrentWorkspace() ws: WorkspaceContext) {
    return this.access.workspacePermissions(ws.workspaceId, ws.roleId);
  }

  @Get('project/:projectId/permission')
  @ApiOperation({
    summary: 'Permissions allowed to the current user for a specific project',
  })
  projectPermission(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
  ) {
    return this.access.projectPermissions(ws.workspaceId, projectId, ws.userId);
  }
}
