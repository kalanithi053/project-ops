import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class InviteProjectMemberDto {
  @ApiProperty({ example: 'john.doe', description: 'Username to invite' })
  @IsString()
  username: string;

  @ApiProperty({ description: 'Role to assign within the project' })
  @IsUUID()
  roleId: string;
}
