import { ApiProperty, OmitType, PartialType } from '@nestjs/swagger';
import { ProjectEngagementType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { CreateProjectDto } from './create-project.dto';

/**
 * Every field is editable, including projectTypeId/planId/hubId/
 * moduleSelections (inherited as-is, still optional, from PartialType
 * below) — changing projectTypeId re-provisions the project the same way
 * picking a type does on create, see ProjectsService.update().
 *
 * The five fields redeclared below are nullable rather than inherited
 * as-is from CreateProjectDto — a project's owner needs to be able to
 * clear a previously-set sales rep/PM/engagement estimate, not just
 * replace it, and PartialType alone only ever produces `undefined` (leave
 * unchanged), never `null` (clear).
 */
export class UpdateProjectDto extends PartialType(
  OmitType(CreateProjectDto, [
    'salesRepId',
    'projectManagerId',
    'engagementType',
    'estimatedHours',
    'estimatedDate',
  ] as const),
) {
  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Workspace member acting as the sales rep on this project. Pass null to clear.',
  })
  @IsOptional()
  @ValidateIf((o: UpdateProjectDto) => o.salesRepId !== null)
  @IsUUID()
  salesRepId?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Workspace member acting as project manager. Pass null to clear.',
  })
  @IsOptional()
  @ValidateIf((o: UpdateProjectDto) => o.projectManagerId !== null)
  @IsUUID()
  projectManagerId?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    enum: ProjectEngagementType,
    description:
      'Commercial engagement model. Pass null to clear (also clears estimatedHours/estimatedDate).',
  })
  @IsOptional()
  @ValidateIf((o: UpdateProjectDto) => o.engagementType !== null)
  @IsEnum(ProjectEngagementType)
  engagementType?: ProjectEngagementType | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Estimated hours — only valid when engagementType is time_and_material. Pass null to clear.',
  })
  @IsOptional()
  @ValidateIf((o: UpdateProjectDto) => o.estimatedHours !== null)
  @IsNumber()
  @Min(0)
  estimatedHours?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Estimated/renewal date — only valid when engagementType is fixed_budget or retainer. Pass null to clear.',
  })
  @IsOptional()
  @ValidateIf((o: UpdateProjectDto) => o.estimatedDate !== null)
  @IsDateString()
  estimatedDate?: string | null;
}
