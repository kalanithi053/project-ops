import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { PERMISSIONS } from '../common/constants/permissions';
import { PlansService } from './plans.service';
import { UpdatePlanDto } from './dto/update-plan.dto';

@ApiTags('plans')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get('active')
  @ApiOperation({ summary: 'Get the active plan for the workspace' })
  getActive(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.plans.getActivePlan(workspaceId);
  }

  @Patch('active')
  @RequirePermission(PERMISSIONS.PLAN_MANAGE)
  @ApiOperation({ summary: 'Update the active plan limits / feature flags' })
  updateActive(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plans.updateActivePlan(workspaceId, dto);
  }
}
