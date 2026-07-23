import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class AttachModuleDto {
  @ApiProperty({ description: 'Catalog module to attach to the project' })
  @IsUUID()
  moduleId: string;

  @ApiProperty({
    required: false,
    description: 'Override the module default task limit for this project',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  taskLimit?: number;
}
