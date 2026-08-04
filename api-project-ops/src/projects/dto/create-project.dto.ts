import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
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
}
