import { ApiProperty } from '@nestjs/swagger';
import { ProjectMode } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Website Revamp' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({
    enum: ProjectMode,
    example: ProjectMode.HubSpot,
    description:
      'Is this project about HubSpot or Dev? HubSpot projects auto-provision default modules + seed tasks.',
  })
  @IsEnum(ProjectMode)
  mode: ProjectMode;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ required: false, example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false, example: '2026-03-31T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
