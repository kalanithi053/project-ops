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
import { WorkspaceMembersService } from './workspace-members.service';
import { InviteWorkspaceMemberDto } from './dto/invite-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';

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

  @Post()
  @RequirePermission(PERMISSIONS.MEMBER_INVITE)
  @ApiOperation({ summary: 'Invite a user to the workspace' })
  invite(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Body() dto: InviteWorkspaceMemberDto,
  ) {
    return this.members.invite(workspaceId, dto);
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
