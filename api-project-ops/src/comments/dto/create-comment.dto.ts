import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'The stage order looks wrong — @john can you check?' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string;

  @ApiProperty({
    required: false,
    type: [String],
    example: ['john@acme.com'],
    description:
      'Emails of workspace members to tag. Each must belong to a member of the active workspace.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEmail({}, { each: true })
  mentions?: string[];
}
