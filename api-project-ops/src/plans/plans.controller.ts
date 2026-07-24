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
import { CurrentWorkspace } from '../common/decorators/current-workspace.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { WorkspaceScopeGuard } from '../common/guards/workspace-scope.guard';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlansService } from './plans.service';

@ApiTags('plans')
@ApiBearerAuth()
@UseGuards(WorkspaceScopeGuard, PermissionsGuard)
@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @ApiOperation({
    summary: 'List all plan tiers for the workspace',
    description:
      'If projectTypeId is provided, filters plans by that project type. Otherwise lists all plans for the workspace.',
  })
  list(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Query('projectTypeId') projectTypeId?: string,
  ) {
    return this.plans.listPlans(workspaceId, projectTypeId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PLAN_MANAGE)
  @ApiOperation({ summary: 'Create a new plan tier' })
  create(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Body() dto: CreatePlanDto,
  ) {
    return this.plans.createPlan(workspaceId, dto);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active plans for the workspace' })
  getActive(@CurrentWorkspace('workspaceId') workspaceId: string) {
    return this.plans.getActivePlans(workspaceId);
  }

  @Post(':planId/activate')
  @RequirePermission(PERMISSIONS.PLAN_MANAGE)
  @ApiOperation({ summary: 'Switch the active plan to the given tier' })
  activate(
    @CurrentWorkspace('workspaceId') workspaceId: string,
    @Param('planId') planId: string,
  ) {
    return this.plans.activatePlan(workspaceId, planId);
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
