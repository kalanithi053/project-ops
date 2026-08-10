import { ApiProperty } from '@nestjs/swagger';
import { ProjectEngagementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * One module to attach to the project being created, each with its own
 * starter-task count. Either `moduleId` (an existing catalog module) or
 * `planId` + `name` (a brand-new module, created under that plan) must be
 * given — enforced in ProjectsService since it depends on which plans were
 * selected elsewhere in the DTO.
 */
export class ModuleSelectionDto {
  @ApiProperty({
    required: false,
    description: 'An existing catalog module to attach.',
  })
  @IsOptional()
  @IsUUID()
  moduleId?: string;

  @ApiProperty({
    required: false,
    description:
      'Plan this brand-new module belongs to — required when moduleId is omitted. Must be one of the project’s selected plans.',
  })
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiProperty({
    required: false,
    description:
      'Name for a brand-new module — required when moduleId is omitted.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiProperty({
    example: 5,
    description: 'Starter tasks to seed for this module, on this project only.',
  })
  @IsInt()
  @Min(0)
  taskLimit: number;
}

export class CreateProjectDto {
  @ApiProperty({ example: 'Website Revamp' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-03-31T00:00:00.000Z' })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description:
      'Project type to create. Its isPlanAdd flag decides whether plan modules + seed tasks are provisioned.',
  })
  @IsUUID()
  projectTypeId: string;

  @ApiProperty({
    required: false,
    type: [String],
    description:
      'Plans the project is created under. Required (min 1) when the project type has isPlanAdd=true.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  planId?: string[];

  @ApiProperty({
    required: false,
    description:
      'Rich text (sanitized HTML) — may include images referencing project attachments.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @ApiProperty({
    required: false,
    description: 'Workspace member acting as the sales rep on this project.',
  })
  @IsOptional()
  @IsUUID()
  salesRepId?: string;

  @ApiProperty({
    required: false,
    description: 'Workspace member acting as project manager.',
  })
  @IsOptional()
  @IsUUID()
  projectManagerId?: string;

  @ApiProperty({
    required: false,
    enum: ProjectEngagementType,
    description:
      'Commercial engagement model — distinct from projectTypeId (HubSpot vs Development).',
  })
  @IsOptional()
  @IsEnum(ProjectEngagementType)
  engagementType?: ProjectEngagementType;

  @ApiProperty({
    required: false,
    description:
      'Estimated hours — only valid when engagementType is time_and_material.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedHours?: number;

  @ApiProperty({
    required: false,
    description:
      'Estimated/renewal date — only valid when engagementType is fixed_budget or retainer.',
  })
  @IsOptional()
  @IsDateString()
  estimatedDate?: string;

  @ApiProperty({
    required: false,
    type: [String],
    description:
      'HubSpot Hubs (Marketing/Sales/Service/...) this engagement covers. Only relevant when the project type is plan-adding (HubSpot). Every selected plan that belongs to a Hub must have that Hub included here.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  hubId?: string[];

  @ApiProperty({
    required: false,
    type: [ModuleSelectionDto],
    description:
      'Explicit module choices for this project (existing catalog modules and/or brand-new ones), each with its own task count. Falls back to each selected plan’s isDefault modules when omitted.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModuleSelectionDto)
  moduleSelections?: ModuleSelectionDto[];
}
