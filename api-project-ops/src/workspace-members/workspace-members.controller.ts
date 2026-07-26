import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';
import { WorkspaceMembersService } from './workspace-members.service';

@ApiTags('workspace-members')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('workspace-members')
export class WorkspaceMembersController {
  constructor(private readonly members: WorkspaceMembersService) {}

  @Get()
  @ApiOperation({ summary: 'List workspace members' })
  list(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.members.list(workspaceId);
  }

  @Patch(':memberId')
  @RequirePermission(PERMISSIONS.MEMBER_INVITE)
  @ApiOperation({ summary: 'Update a workspace member role/status' })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateWorkspaceMemberDto,
  ) {
    return this.members.update(workspaceId, memberId, dto);
  }

  @Delete(':memberId')
  @RequirePermission(PERMISSIONS.MEMBER_REMOVE)
  @ApiOperation({ summary: 'Remove a workspace member' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.members.remove(workspaceId, memberId);
  }
}
