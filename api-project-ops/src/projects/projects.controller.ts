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
  @ApiOperation({ summary: 'List projects in the workspace' })
  list(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.projects.list(workspaceId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ summary: 'Get a project with its modules and members' })
  findOne(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.projects.findOne(workspaceId, id);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.PROJECT_UPDATE)
  @ApiOperation({ summary: 'Update a project' })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PROJECT_DELETE)
  @ApiOperation({ summary: 'Soft-delete a project' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.projects.remove(workspaceId, id);
  }
}
