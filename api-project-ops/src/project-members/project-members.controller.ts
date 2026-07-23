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
import { ProjectMembersService } from './project-members.service';
import { InviteProjectMemberDto } from './dto/invite-project-member.dto';
import { UpdateProjectMemberDto } from './dto/update-project-member.dto';

@ApiTags('project-members')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('projects/:projectId/members')
export class ProjectMembersController {
  constructor(private readonly members: ProjectMembersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ summary: 'List project members' })
  list(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.members.list(workspaceId, projectId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.MEMBER_INVITE)
  @ApiOperation({ summary: 'Invite a member (auto-invites to workspace if needed)' })
  invite(
    @CurrentWorkspace() ws: { workspaceId: string; userId: string },
    @Param('projectId') projectId: string,
    @Body() dto: InviteProjectMemberDto,
  ) {
    return this.members.invite(ws.workspaceId, projectId, ws.userId, dto);
  }

  @Patch(':memberId')
  @RequirePermission(PERMISSIONS.MEMBER_INVITE)
  @ApiOperation({ summary: 'Update a project member role/status' })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateProjectMemberDto,
  ) {
    return this.members.update(workspaceId, projectId, memberId, dto);
  }

  @Delete(':memberId')
  @RequirePermission(PERMISSIONS.MEMBER_REMOVE)
  @ApiOperation({ summary: 'Remove a project member' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.members.remove(workspaceId, projectId, memberId);
  }
}
