import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsUUID } from 'class-validator';

export class InviteWorkspaceMemberDto {
  @ApiProperty({ example: 'john@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    required: false,
    description: 'Role to assign; defaults to the workspace default role',
  })
  @IsOptional()
  @IsUUID()
  roleId?: string;
}
