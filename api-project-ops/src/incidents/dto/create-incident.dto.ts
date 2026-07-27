import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateIncidentDto {
  @ApiProperty({ example: 'Pipeline stage order is wrong' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiProperty({
    required: false,
    description: 'What is flawed in the implementation',
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiProperty({ required: false, description: 'Workspace member to assign' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiProperty({ required: false, minimum: 0, example: 4 })
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
