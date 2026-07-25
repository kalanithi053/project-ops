import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsUUID } from 'class-validator';

export class InviteProjectMemberDto {
  @ApiProperty({ example: 'john@acme.com', description: 'Email to invite' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Role to assign within the project' })
  @IsUUID()
  roleId: string;
}
