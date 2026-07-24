import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard)
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
}
