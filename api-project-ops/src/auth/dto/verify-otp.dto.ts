import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: 'jane@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit one-time password' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'otp must be 6 digits' })
  otp: string;
}
