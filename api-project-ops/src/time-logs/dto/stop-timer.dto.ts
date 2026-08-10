import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class StopTimerDto {
  @ApiPropertyOptional({
    description: 'Optional note to attach when stopping the timer.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
