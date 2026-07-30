import { PartialType } from '@nestjs/swagger';
import { CreateWorkTypeDto } from './create-work-type.dto';

export class UpdateWorkTypeDto extends PartialType(CreateWorkTypeDto) {}
