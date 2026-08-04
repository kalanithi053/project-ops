import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ThemeColor, ThemeMode } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateMyThemeDto {
  @ApiProperty({ enum: ThemeMode })
  @IsEnum(ThemeMode)
  theme: ThemeMode;

  @ApiPropertyOptional({ enum: ThemeColor, default: ThemeColor.blue })
  @IsOptional()
  @IsEnum(ThemeColor)
  themeColor: ThemeColor = ThemeColor.blue;
}
