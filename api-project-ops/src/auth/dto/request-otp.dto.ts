import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: 'jane@acme.com', description: 'Login email' })
  @IsEmail()
  email: string;
}
