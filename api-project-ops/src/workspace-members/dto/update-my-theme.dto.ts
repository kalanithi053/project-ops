import { ApiProperty } from '@nestjs/swagger';
import { ThemeMode } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateMyThemeDto {
  @ApiProperty({ enum: ThemeMode })
  @IsEnum(ThemeMode)
  theme: ThemeMode;
}
