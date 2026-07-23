import { ApiProperty } from '@nestjs/swagger';
import { StatusCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateTicketStatusDto {
  @ApiProperty({ example: 'In Review' })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({ required: false, example: '#f59e0b' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiProperty({ enum: StatusCategory, example: StatusCategory.in_progress })
  @IsEnum(StatusCategory)
  category: StatusCategory;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
