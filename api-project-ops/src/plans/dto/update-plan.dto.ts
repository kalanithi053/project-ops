import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePlanDto {
  @ApiProperty({ required: true, example: 'Pro' })
  @IsString()
  @MaxLength(50)
  name!: string;

  @ApiProperty({
    required: false,
    type: Object,
    description: 'Arbitrary feature-flag map',
  })
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @ApiProperty({ required: true })
  @IsBoolean()
  isActive!: boolean;
}
