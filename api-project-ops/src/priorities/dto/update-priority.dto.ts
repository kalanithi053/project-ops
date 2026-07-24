import { PartialType } from '@nestjs/swagger';
import { CreatePriorityDto } from './create-priority.dto';

export class UpdatePriorityDto extends PartialType(CreatePriorityDto) {}
