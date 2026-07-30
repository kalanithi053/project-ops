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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('roles')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard, WorkspaceOwnerGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ROLE_MANAGE)
  @ApiOperation({ summary: 'List workspace roles with their permissions' })
  list(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.roles.list(workspaceId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.ROLE_MANAGE)
  @ApiOperation({ summary: 'Create a custom role' })
  create(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Body() dto: CreateRoleDto,
  ) {
    return this.roles.create(workspaceId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.ROLE_MANAGE)
  @ApiOperation({ summary: 'Update a role and/or its permissions' })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roles.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.ROLE_MANAGE)
  @ApiOperation({
    summary: 'Delete a custom role (system roles are protected)',
  })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.roles.remove(workspaceId, id);
  }
}
