import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
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
}
