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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkspaceOwnerGuard } from '../common/guards/workspace-owner.guard';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { CreateHubDto } from './dto/create-hub.dto';
import { UpdateHubDto } from './dto/update-hub.dto';
import { HubsService } from './hubs.service';

@ApiTags('hubs')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('hubs')
export class HubsController {
  constructor(private readonly hubs: HubsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List HubSpot Hubs (Marketing, Sales, Service, ...) for a project type',
    description:
      'projectTypeId is required — Hubs only exist under a plan-adding project type.',
  })
  list(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Query('projectTypeId') projectTypeId?: string,
  ) {
    return this.hubs.listHubs(workspaceId, projectTypeId);
  }

  @Post()
  @UseGuards(WorkspaceOwnerGuard)
  @RequirePermission(PERMISSIONS.HUB_MANAGE)
  @ApiOperation({ summary: 'Create a Hub (seeds its 3 tier plans)' })
  create(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Body() dto: CreateHubDto,
  ) {
    return this.hubs.createHub(workspaceId, dto);
  }

  @Patch(':hubId')
  @UseGuards(WorkspaceOwnerGuard)
  @RequirePermission(PERMISSIONS.HUB_MANAGE)
  @ApiOperation({ summary: 'Update a Hub' })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('hubId') hubId: string,
    @Body() dto: UpdateHubDto,
  ) {
    return this.hubs.updateHub(workspaceId, hubId, dto);
  }

  @Delete(':hubId')
  @UseGuards(WorkspaceOwnerGuard)
  @RequirePermission(PERMISSIONS.HUB_MANAGE)
  @ApiOperation({ summary: 'Delete a Hub (cascades its tier plans)' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('hubId') hubId: string,
  ) {
    return this.hubs.deleteHub(workspaceId, hubId);
  }
}
