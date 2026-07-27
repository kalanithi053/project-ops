import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Design landing page' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiProperty({
    required: false,
    example: 'Pipeline',
    description: 'Name prefix (e.g. the module name the task belongs to)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  prefix?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiProperty({
    required: false,
    description: 'Module instance this task belongs to',
  })
  @IsOptional()
  @IsUUID()
  moduleInstanceId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  statusId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  priorityId?: string;

  @ApiProperty({
    required: false,
    type: [String],
    description:
      'Users assigned to this task. On update the array replaces the whole set; omit the key to leave assignees untouched.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  assigneeIds?: string[];

  @ApiProperty({
    required: false,
    minimum: 0,
    maximum: 10000,
    description: 'Estimated effort in whole hours.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  etaHours?: number;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
