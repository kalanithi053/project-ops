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
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';
import { WorkspaceMembersService } from './workspace-members.service';

@ApiTags('workspace-members')
@ApiBearerAuth()
@Controller('workspace-members')
export class WorkspaceMembersController {
  constructor(private readonly members: WorkspaceMembersService) {}

  @Get()
  @UseGuards(WorkspaceScopeGuard, PermissionsGuard)
  @ApiOperation({ summary: 'List workspace members' })
  list(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.members.list(workspaceId);
  }

  @Patch(':memberId')
  @UseGuards(WorkspaceScopeGuard, PermissionsGuard)
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
  @UseGuards(WorkspaceScopeGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.MEMBER_REMOVE)
  @ApiOperation({ summary: 'Remove a workspace member' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.members.remove(workspaceId, memberId);
  }

  @Patch(':workspaceId/default')
  @ApiOperation({
    summary:
      "Mark a workspace as the current user's default (clears it from any other workspace of theirs)",
  })
  setDefault(
    @CurrentUser('sub') userId: string,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.members.setDefault(userId, workspaceId);
  }
}
