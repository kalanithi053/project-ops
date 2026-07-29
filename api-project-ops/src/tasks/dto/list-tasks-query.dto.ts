import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return typeof value === 'string' ? [value] : [];
}

/** Query filters for the project task list used by the board. */
export class ListTasksQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  moduleInstanceId?: string;

  @ApiPropertyOptional({ type: String, isArray: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toStringArray(value))
  @IsArray()
  @IsUUID('4', { each: true })
  moduleInstanceIds?: string[];

  @ApiPropertyOptional({
    description:
      'Ticket status ID, or __unassigned__ for tasks without a status',
  })
  @IsOptional()
  @IsString()
  statusId?: string;

  @ApiPropertyOptional({ type: String, isArray: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toStringArray(value))
  @IsArray()
  @IsUUID('4', { each: true })
  statusIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priorityId?: string;

  @ApiPropertyOptional({ description: 'Matches task name or prefix' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    description: 'One or more assignee user IDs',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toStringArray(value))
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional({ example: '2026-07-28' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-08-08' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
