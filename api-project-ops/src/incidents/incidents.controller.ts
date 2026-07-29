import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
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
    @Query() filters: ListIncidentsQueryDto,
  ) {
    return this.incidents.list(workspaceId, projectId, filters);
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

  @Patch(':incidentId')
  @RequirePermission(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Update an incident ticket' })
  update(
    @CurrentWorkspace() ws: WorkspaceContext,
    @Param('projectId') projectId: string,
    @Param('incidentId') incidentId: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.incidents.update(
      ws.workspaceId,
      projectId,
      incidentId,
      ws.userId,
      dto,
    );
  }

  @Get(':incidentId/activity')
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({ summary: "Get an incident's activity log" })
  getActivity(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('incidentId') incidentId: string,
  ) {
    return this.incidents.getActivity(workspaceId, projectId, incidentId);
  }

  @Post(':incidentId/notify')
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @ApiOperation({
    summary: "Email the assignee the incident's current status",
  })
  notifyAssignee(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('incidentId') incidentId: string,
  ) {
    return this.incidents.notifyAssignee(workspaceId, projectId, incidentId);
  }
}
