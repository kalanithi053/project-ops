import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ description: 'Plan this module belongs to' })
  @IsUUID()
  planId: string;

  @ApiProperty({ example: 'pipeline', description: 'Stable machine key' })
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'key may only contain lowercase letters, numbers and underscore',
  })
  key: string;

  @ApiProperty({ example: 'Pipeline' })
  @IsString()
  @MaxLength(80)
  name: string;

  @ApiProperty({ required: false, default: 10, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultTaskLimit?: number;

  @ApiProperty({
    required: false,
    default: false,
    description: 'Auto-attach to every new project',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
