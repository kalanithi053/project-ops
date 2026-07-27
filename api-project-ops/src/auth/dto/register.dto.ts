import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'jane@acme.com', description: 'Unique login email' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName: string;

  @ApiProperty({ required: false, example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;
}
