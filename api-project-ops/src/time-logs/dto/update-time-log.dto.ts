import { PartialType } from '@nestjs/swagger';
import { CreateTimeLogDto } from './create-time-log.dto';

export class UpdateTimeLogDto extends PartialType(CreateTimeLogDto) {}
