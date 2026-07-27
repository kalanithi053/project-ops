import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateWorkspaceSettingsDto {
  @ApiProperty({ required: false, example: 'Amwhiz' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  /**
   * The slug doubles as the `x-workspace-slug` tenant header and the first
   * URL segment, so it's constrained to a lowercase URL-safe form rather
   * than accepting any string the way `CreateWorkspaceDto` does.
   */
  @ApiProperty({
    required: false,
    example: 'amwhiz',
    description:
      'Lowercase letters, digits and single hyphens. Changing this changes the workspace URL and the x-workspace-slug header.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'slug must be lowercase alphanumeric, optionally separated by single hyphens',
  })
  slug?: string;
}
