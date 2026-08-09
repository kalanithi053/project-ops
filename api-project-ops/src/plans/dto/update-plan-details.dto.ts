import { ApiProperty } from '@nestjs/swagger';
import {
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdatePlanDetailsDto {
  @ApiProperty({ required: false, example: 'Enterprise' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiProperty({
    required: false,
    type: Object,
    description: 'Arbitrary feature-flag map',
  })
  @IsOptional()
  @IsObject()
  features?: Record<string, unknown>;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Hub this plan is a tier of. Pass null to un-scope it back to a generic plan.',
  })
  @IsOptional()
  @IsUUID()
  hubId?: string | null;
}
