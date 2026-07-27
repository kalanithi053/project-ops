import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { SettingsService } from './settings.service';
import { UpdateWorkspaceSettingsDto } from './dto/update-workspace-settings.dto';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('workspace/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /**
   * Deliberately ungated: the settings bundle is the bootstrap payload for
   * the settings UI, and every member needs to read statuses, priorities and
   * roles to render tasks. Writes below are gated individually.
   */
  @Get()
  @ApiOperation({
    summary:
      'Full workspace settings bundle: details, plans (with modules), ticket statuses, priorities, roles (with permissions) and the permission catalog',
  })
  get(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.settings.getSettings(workspaceId);
  }

  @Patch()
  @RequirePermission(PERMISSIONS.WORKSPACE_MANAGE)
  @ApiOperation({
    summary: "Update the workspace's identity (display name and URL slug)",
  })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceSettingsDto,
  ) {
    return this.settings.updateWorkspace(workspaceId, dto);
  }
}
