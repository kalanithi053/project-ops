import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a workspace (provisions default roles, modules, statuses, plan)' })
  async create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateWorkspaceDto,
  ) {
    const workspace = await this.workspaces.create(userId, dto);
    return { ...workspace, message: 'Workspace created' };
  }

  @Get('me')
  @ApiOperation({ summary: 'List workspaces the current user belongs to' })
  listMine(@CurrentUser('sub') userId: string) {
    return this.workspaces.listForUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workspace the current user belongs to' })
  findOne(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.workspaces.findOneForUser(userId, id);
  }
}
