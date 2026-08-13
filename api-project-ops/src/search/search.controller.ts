import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentWorkspace,
  WorkspaceContext,
} from '../common/decorators/current-workspace.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Search projects, work items, and members in the active workspace',
  })
  find(
    @CurrentWorkspace() workspace: WorkspaceContext,
    @Query() query: SearchQueryDto,
  ) {
    return this.search.search(
      workspace.workspaceId,
      workspace.userId,
      workspace.isManagerTier,
      query.q ?? '',
      query.limit,
    );
  }
}
