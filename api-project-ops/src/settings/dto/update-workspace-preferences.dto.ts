import { ApiPropertyOptional } from '@nestjs/swagger';
import { TimeLogPastLimitUnit } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateWorkspacePreferencesDto {
  @ApiPropertyOptional({
    description: 'Whether members can add manual (non-timer) time log entries.',
  })
  @IsOptional()
  @IsBoolean()
  allowManualTimeLog?: boolean;

  @ApiPropertyOptional({
    description: 'Whether a log entry may be dated before today.',
  })
  @IsOptional()
  @IsBoolean()
  allowPastTimeLog?: boolean;

  @ApiPropertyOptional({
    description:
      'How far back a past-dated entry may go, in pastTimeLogLimitUnit units. Omit/null for unlimited.',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  pastTimeLogLimitValue?: number | null;

  @ApiPropertyOptional({ enum: TimeLogPastLimitUnit })
  @IsOptional()
  @IsEnum(TimeLogPastLimitUnit)
  pastTimeLogLimitUnit?: TimeLogPastLimitUnit;
}
