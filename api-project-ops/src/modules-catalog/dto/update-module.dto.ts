import { PartialType } from '@nestjs/swagger';
import { OmitType } from '@nestjs/swagger';
import { CreateModuleDto } from './create-module.dto';

// key is immutable once created.
export class UpdateModuleDto extends PartialType(
  OmitType(CreateModuleDto, ['key'] as const),
) {}
