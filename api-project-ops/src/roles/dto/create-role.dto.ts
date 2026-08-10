import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Project Lead' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({
    required: false,
    default: false,
    description:
      'Workspace-wide dashboard visibility for members with this role, instead of just their own assigned work.',
  })
  @IsOptional()
  @IsBoolean()
  isManagerTier?: boolean;

  @ApiProperty({
    required: false,
    type: [String],
    example: ['project.create', 'task.create'],
    description: 'Permission codes to assign to this role',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionCodes?: string[];
}
