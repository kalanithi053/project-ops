import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkspaceOwnerGuard } from '../common/guards/workspace-owner.guard';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { SettingsService } from './settings.service';
import { UpdateWorkspaceSettingsDto } from './dto/update-workspace-settings.dto';
import { UpdateWorkspacePreferencesDto } from './dto/update-workspace-preferences.dto';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('workspace/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Full workspace settings bundle: details, plans (with modules), ticket statuses, priorities, roles (with permissions) and the permission catalog',
  })
  get(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.settings.getSettings(workspaceId);
  }

  @Patch()
  @UseGuards(WorkspaceOwnerGuard)
  @ApiOperation({ summary: 'Update the workspace name and/or URL slug' })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspaceSettingsDto,
  ) {
    return this.settings.updateWorkspace(workspaceId, dto);
  }

  @Patch('preferences')
  @UseGuards(WorkspaceOwnerGuard)
  @ApiOperation({ summary: 'Update the workspace time-log restrictions' })
  updatePreferences(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Body() dto: UpdateWorkspacePreferencesDto,
  ) {
    return this.settings.updatePreferences(workspaceId, dto);
  }
}
