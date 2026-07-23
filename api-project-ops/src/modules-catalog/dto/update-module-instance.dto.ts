import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateModuleInstanceDto {
  @ApiProperty({ minimum: 0, description: 'New per-project task limit' })
  @IsInt()
  @Min(0)
  taskLimit: number;
}
