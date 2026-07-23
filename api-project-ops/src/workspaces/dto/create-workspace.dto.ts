import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Acme Inc' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({
    required: false,
    description: 'Optional custom slug; auto-generated from name when omitted',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;
}
