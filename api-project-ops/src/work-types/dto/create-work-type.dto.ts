import { ApiProperty } from '@nestjs/swagger';
import { WorkTypeCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateWorkTypeDto {
  @ApiProperty({ example: 'Task' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ required: false, example: '#e4f468ff' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiProperty({ enum: WorkTypeCategory, example: WorkTypeCategory.task })
  @IsEnum(WorkTypeCategory)
  category: WorkTypeCategory;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
