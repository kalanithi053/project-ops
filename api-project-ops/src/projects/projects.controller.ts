import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import {
  CurrentWorkspace,
  WorkspaceContext,
} from '../common/decorators/current-workspace.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @RequirePermission(PERMISSIONS.PROJECT_CREATE)
  @ApiOperation({
    summary: 'Create a project (auto-attaches default modules + seed tasks)',
  })
  create(
    @CurrentWorkspace() ws: { workspaceId: string; userId: string },
    @Body() dto: CreateProjectDto,
  ) {
    return this.projects.create(ws.workspaceId, ws.userId, dto);
  }

  @Get()
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ summary: "List the caller's projects in the workspace" })
  list(@CurrentWorkspace() ws: { workspaceId: string; userId: string }) {
    return this.projects.list(ws.workspaceId, ws.userId);
  }

  @Get('utilization')
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({
    summary:
      'Per-project hours/schedule utilization and work-item completion, for the dashboard — Owner/Admin/Client only',
  })
  getUtilization(@CurrentWorkspace() ws: WorkspaceContext) {
    if (!ws.isManagerTier) {
      throw new ForbiddenException(
        'Your role is not set up for project utilization — enable it in Settings > Roles.',
      );
    }
    return this.projects.getUtilization(ws.workspaceId);
  }

  @Get(':projectId')
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ summary: 'Get a project with its modules and members' })
  findOne(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.findOne(workspaceId, projectId);
  }

  @Patch(':projectId')
  @RequirePermission(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({ summary: 'Update a project' })
  update(
    @CurrentWorkspace() ws: { workspaceId: string; userId: string },
    @Param('projectId') projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(ws.workspaceId, projectId, dto, ws.userId);
  }

  @Delete(':projectId')
  @RequirePermission(PERMISSIONS.PROJECT_DELETE)
  @ApiOperation({ summary: 'Soft-delete a project' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.projects.remove(workspaceId, projectId);
  }
}
