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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermission(PERMISSIONS.TASK_READ)
  @ApiOperation({ summary: 'List tasks in a project' })
  @ApiQuery({ name: 'moduleInstanceId', required: false })
  @ApiQuery({ name: 'statusId', required: false })
  @ApiQuery({ name: 'priorityId', required: false })
  list(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query('moduleInstanceId') moduleInstanceId?: string,
    @Query('statusId') statusId?: string,
    @Query('priorityId') priorityId?: string,
  ) {
    return this.tasks.list(workspaceId, projectId, {
      moduleInstanceId,
      statusId,
      priorityId,
    });
  }

  @Post()
  @RequirePermission(PERMISSIONS.TASK_CREATE)
  @ApiOperation({ summary: 'Create a task (enforces module task limit)' })
  create(
    @CurrentWorkspace() ws: { workspaceId: string; userId: string },
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(ws.workspaceId, projectId, ws.userId, dto);
  }

  @Get(':taskId')
  @RequirePermission(PERMISSIONS.TASK_READ)
  @ApiOperation({ summary: 'Get a task' })
  findOne(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tasks.findOne(workspaceId, projectId, taskId);
  }

  @Patch(':taskId')
  @RequirePermission(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Update a task' })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(workspaceId, projectId, taskId, dto);
  }

  @Delete(':taskId')
  @RequirePermission(PERMISSIONS.TASK_DELETE)
  @ApiOperation({ summary: 'Soft-delete a task' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tasks.remove(workspaceId, projectId, taskId);
  }
}
