import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../common/constants/permissions';
import {
  CurrentWorkspace,
  WorkspaceContext,
} from '../common/decorators/current-workspace.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { IncidentsService } from './incidents.service';

@ApiTags('incidents')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('projects/:projectId/incidents')
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Post()
  @RequirePermission(PERMISSIONS.INCIDENT_CREATE)
  @ApiOperation({
    summary:
      'Create a standalone incident ticket on a project (not tied to a task)',
  })
  create(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.incidents.create(ws.workspaceId, projectId, ws.userId, dto);
  }

  @Get()
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ summary: "List the project's incident tickets" })
  list(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
  ) {
    return this.incidents.list(workspaceId, projectId);
  }

  @Get(':incidentId')
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ summary: 'Get one incident ticket' })
  findOne(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('incidentId') incidentId: string,
  ) {
    return this.incidents.findOne(workspaceId, projectId, incidentId);
  }
}
