import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
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

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiProperty({ required: false, description: 'Workspace member responsible for QA' })
  @IsOptional()
  @IsUUID()
  qaAssigneeId?: string;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ApiProperty({ required: false, minimum: 0, example: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimateHours?: number;

  @ApiProperty({ required: false, minimum: 0, example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  completedHours?: number;
}
