import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePlanDto {
  @ApiProperty({ description: 'Project type this plan belongs to' })
  @IsUUID()
  projectTypeId: string;

  @ApiProperty({
    required: false,
    description: 'Scopes this plan as a tier of the given Hub',
  })
  @IsOptional()
  @IsUUID()
  hubId?: string;

  @ApiProperty({ example: 'Starter' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({
    required: false,
    type: Object,
    description: 'Feature-flag map',
  })
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
