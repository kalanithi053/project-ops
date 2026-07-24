import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ description: 'Project type this plan belongs to' })
  @IsUUID()
  projectTypeId: string;

  @ApiProperty({ example: 'Starter' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({ required: false, minimum: 0, default: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxProjects?: number;

  @ApiProperty({ required: false, minimum: 0, default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxMembers?: number;

  @ApiProperty({ required: false, minimum: 0, default: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxTasksPerModule?: number;

  @ApiProperty({ required: false, type: Object, description: 'Feature-flag map' })
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @ApiProperty({
    required: false,
    default: false,
    description: 'Make this the active plan (deactivates the others)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
