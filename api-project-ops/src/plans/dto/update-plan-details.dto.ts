import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for `PATCH /plans/:planId`.
 *
 * Deliberately excludes `isActive` — activation has its own endpoint
 * (`POST /plans/:planId/activate`) which also deactivates the other plans, so
 * accepting the flag here would give two ways to do it, one of them wrong.
 */
export class UpdatePlanDetailsDto {
  @ApiProperty({ required: false, example: 'Standard Plan' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;
}
