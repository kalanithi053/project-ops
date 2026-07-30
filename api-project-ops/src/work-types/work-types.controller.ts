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
import { WorkTypesService } from './work-types.service';
import { CreateWorkTypeDto } from './dto/create-work-type.dto';
import { UpdateWorkTypeDto } from './dto/update-work-type.dto';

@ApiTags('work-types')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('work-types')
export class WorkTypesController {
  constructor(private readonly service: WorkTypesService) {}

  @Get()
  @ApiOperation({ summary: 'List the workspace work type catalog' })
  list(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.service.list(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single work type' })
  findOne(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(workspaceId, id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.WORKTYPE_MANAGE)
  @ApiOperation({ summary: 'Create a work type' })
  create(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Body() dto: CreateWorkTypeDto,
  ) {
    return this.service.create(workspaceId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.WORKTYPE_MANAGE)
  @ApiOperation({ summary: 'Update a work type' })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkTypeDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.WORKTYPE_MANAGE)
  @ApiOperation({ summary: 'Delete a work type' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(workspaceId, id);
  }
}
