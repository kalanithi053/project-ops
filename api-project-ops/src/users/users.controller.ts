import { Body, Controller, Get, Headers, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WORKSPACE_SLUG_HEADER } from '../common/guards/workspace-scope.guard';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiHeader({
    name: WORKSPACE_SLUG_HEADER,
    required: false,
    description: 'Include to populate the user\'s role + allowed permissions for that workspace',
  })
  @ApiOperation({ summary: 'Get the current user profile (+ permissions for the active workspace)' })
  me(
    @CurrentUser('sub') userId: string,
    @Headers(WORKSPACE_SLUG_HEADER) workspaceSlug?: string,
  ) {
    return this.users.getProfile(userId, workspaceSlug);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  update(@CurrentUser('sub') userId: string, @Body() dto: UpdateUserDto) {
    return this.users.updateProfile(userId, dto);
  }
}
