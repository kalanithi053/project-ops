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
import { WorkspaceOwnerGuard } from '../common/guards/workspace-owner.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { ProjectTypesService } from './project-types.service';
import { CreateProjectTypeDto } from './dto/create-project-type.dto';
import { UpdateProjectTypeDto } from './dto/update-project-type.dto';

@ApiTags('project-types')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('project-types')
export class ProjectTypesController {
  constructor(private readonly service: ProjectTypesService) {}

  @Get()
  @ApiOperation({ summary: 'List project types (chosen at project creation)' })
  list(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.service.list(workspaceId);
  }

  @Post()
  @UseGuards(WorkspaceOwnerGuard)
  @RequirePermission(PERMISSIONS.PROJECTTYPE_MANAGE)
  @ApiOperation({ summary: 'Create a project type' })
  create(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Body() dto: CreateProjectTypeDto,
  ) {
    return this.service.create(workspaceId, dto);
  }

  @Patch(':id')
  @UseGuards(WorkspaceOwnerGuard)
  @RequirePermission(PERMISSIONS.PROJECTTYPE_MANAGE)
  @ApiOperation({ summary: 'Update a project type' })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectTypeDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @UseGuards(WorkspaceOwnerGuard)
  @RequirePermission(PERMISSIONS.PROJECTTYPE_MANAGE)
  @ApiOperation({ summary: 'Delete a project type' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(workspaceId, id);
  }
}
