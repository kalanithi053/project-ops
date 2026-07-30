import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimeLogBillingType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTimeLogDto {
  @ApiProperty({ example: '2026-07-30' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({
    description: 'Required unless startTime and endTime are both given.',
    minimum: 1,
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional({
    description: 'Full ISO timestamp. Must be given together with endTime.',
  })
  @IsOptional()
  @IsISO8601()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Full ISO timestamp. Must be given together with startTime.',
  })
  @IsOptional()
  @IsISO8601()
  endTime?: string;

  @ApiPropertyOptional({
    enum: TimeLogBillingType,
    default: TimeLogBillingType.billable,
  })
  @IsOptional()
  @IsEnum(TimeLogBillingType)
  billingType?: TimeLogBillingType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
