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
import { PrioritiesService } from './priorities.service';
import { CreatePriorityDto } from './dto/create-priority.dto';
import { UpdatePriorityDto } from './dto/update-priority.dto';

@ApiTags('priorities')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('priorities')
export class PrioritiesController {
  constructor(private readonly service: PrioritiesService) {}

  @Get()
  @ApiOperation({ summary: 'List the workspace priority list' })
  list(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.service.list(workspaceId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PRIORITY_MANAGE)
  @ApiOperation({ summary: 'Create a priority' })
  create(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Body() dto: CreatePriorityDto,
  ) {
    return this.service.create(workspaceId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.PRIORITY_MANAGE)
  @ApiOperation({ summary: 'Update a priority' })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePriorityDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PRIORITY_MANAGE)
  @ApiOperation({ summary: 'Delete a priority' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(workspaceId, id);
  }
}
