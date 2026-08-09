import { ApiProperty } from '@nestjs/swagger';
import { ProjectEngagementType } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
  MinLength,
} from 'class-validator';

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
}
