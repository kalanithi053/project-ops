import { PartialType } from '@nestjs/swagger';
import { OmitType } from '@nestjs/swagger';
import { CreateModuleDto } from './create-module.dto';

// key and planId are immutable once created.
export class UpdateModuleDto extends PartialType(
  OmitType(CreateModuleDto, ['key', 'planId'] as const),
) {}
