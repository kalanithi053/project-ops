import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateTaskStatusDto {
  @ApiProperty({ description: 'Ticket status to move the task to' })
  @IsUUID()
  statusId: string;
}
