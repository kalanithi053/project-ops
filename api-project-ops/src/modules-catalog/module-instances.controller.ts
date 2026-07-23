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
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { ModuleInstancesService } from './module-instances.service';
import { AttachModuleDto } from './dto/attach-module.dto';
import { UpdateModuleInstanceDto } from './dto/update-module-instance.dto';

@ApiTags('module-instances')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('projects/:projectId/modules')
export class ModuleInstancesController {
  constructor(private readonly instances: ModuleInstancesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ summary: 'List modules attached to a project' })
  list(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.instances.list(workspaceId, projectId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.MODULE_MANAGE)
  @ApiOperation({ summary: 'Attach a module to a project' })
  attach(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Body() dto: AttachModuleDto,
  ) {
    return this.instances.attach(workspaceId, projectId, dto);
  }

  @Patch(':instanceId')
  @RequirePermission(PERMISSIONS.MODULE_MANAGE)
  @ApiOperation({ summary: 'Override a module instance task limit' })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('instanceId') instanceId: string,
    @Body() dto: UpdateModuleInstanceDto,
  ) {
    return this.instances.update(workspaceId, projectId, instanceId, dto);
  }

  @Delete(':instanceId')
  @RequirePermission(PERMISSIONS.MODULE_MANAGE)
  @ApiOperation({ summary: 'Detach a module from a project' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('instanceId') instanceId: string,
  ) {
    return this.instances.remove(workspaceId, projectId, instanceId);
  }
}
