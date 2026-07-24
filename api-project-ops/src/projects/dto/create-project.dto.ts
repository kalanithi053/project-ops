import { ApiProperty } from '@nestjs/swagger';
import {
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
    description:
      'Plan the project is created under. If omitted, the active plan is used.',
  })
  @IsUUID()
  @IsOptional()
  planId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
