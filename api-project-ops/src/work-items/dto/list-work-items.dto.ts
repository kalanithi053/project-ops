import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkTypeCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

/** Normalizes a repeated query key (`?x=a&x=b`) or a single occurrence into an array. */
function toArray({ value }: { value: unknown }): string[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? (value as string[]) : [value as string];
}

export class ListWorkItemsQueryDto {
  @ApiPropertyOptional({ description: 'Matches against name or prefix' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(toArray)
  @IsUUID('4', { each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  moduleInstanceId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(toArray)
  @IsUUID('4', { each: true })
  moduleInstanceIds?: string[];

  /** Either a real status id or the "__unassigned__" sentinel for "no status". */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  statusId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(toArray)
  @IsString({ each: true })
  statusIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  priorityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** Work items with no WorkType are treated as "task" (mirrors work-items.service.ts). */
  @ApiPropertyOptional({ enum: WorkTypeCategory })
  @IsOptional()
  @IsEnum(WorkTypeCategory)
  category?: WorkTypeCategory;
}
