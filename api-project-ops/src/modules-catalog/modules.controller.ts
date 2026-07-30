import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { ModulesService } from './modules.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';

@ApiTags('modules')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('modules')
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}

  @Get()
  @ApiOperation({
    summary: 'List workspace modules (optionally filtered by plan)',
  })
  @ApiQuery({ name: 'planId', required: false })
  list(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Query('planId') planId?: string,
  ) {
    return this.modules.list(workspaceId, planId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.MODULE_MANAGE)
  @ApiOperation({ summary: 'Create a workspace module' })
  create(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Body() dto: CreateModuleDto,
  ) {
    return this.modules.create(workspaceId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.MODULE_MANAGE)
  @ApiOperation({ summary: 'Update a workspace module' })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateModuleDto,
  ) {
    return this.modules.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.MODULE_MANAGE)
  @ApiOperation({ summary: 'Delete a workspace module' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.modules.remove(workspaceId, id);
  }
}
