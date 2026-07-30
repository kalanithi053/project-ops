import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProjectTypeDto {
  @ApiProperty({ example: 'Standard' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name: string;

  @ApiProperty({ required: false, example: '#f59e0b' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    required: false,
    default: true,
    description:
      'When false, creating a project of this type skips plan quota, module attachment and seed tasks',
  })
  @IsOptional()
  @IsBoolean()
  isPlanAdd?: boolean;
}
