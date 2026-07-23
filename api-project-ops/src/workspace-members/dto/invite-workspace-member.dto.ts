import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class InviteWorkspaceMemberDto {
  @ApiProperty({ example: 'john.doe' })
  @IsString()
  username: string;

  @ApiProperty({
    required: false,
    description: 'Role to assign; defaults to the workspace default role',
  })
  @IsOptional()
  @IsUUID()
  roleId?: string;
}
