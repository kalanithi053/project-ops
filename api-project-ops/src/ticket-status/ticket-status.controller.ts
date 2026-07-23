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
import { TicketStatusService } from './ticket-status.service';
import { CreateTicketStatusDto } from './dto/create-ticket-status.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

@ApiTags('ticket-status')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('ticket-statuses')
export class TicketStatusController {
  constructor(private readonly service: TicketStatusService) {}

  @Get()
  @ApiOperation({ summary: 'List the workspace ticket status pipeline' })
  list(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.service.list(workspaceId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.TICKETSTATUS_MANAGE)
  @ApiOperation({ summary: 'Create a ticket status' })
  create(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Body() dto: CreateTicketStatusDto,
  ) {
    return this.service.create(workspaceId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.TICKETSTATUS_MANAGE)
  @ApiOperation({ summary: 'Update a ticket status' })
  update(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.TICKETSTATUS_MANAGE)
  @ApiOperation({ summary: 'Delete a ticket status' })
  remove(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(workspaceId, id);
  }
}
