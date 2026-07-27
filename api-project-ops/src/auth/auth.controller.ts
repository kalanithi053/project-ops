import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user (after the Create-User signal) and send an OTP',
  })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Request an OTP for an email. Unknown users are not created — the response returns { slug: "Create-User" } so the client can register first.',
  })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.email);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Verify an OTP and receive the access/refresh token pair. Pass the chosen workspace via the x-workspace-slug header on subsequent requests.',
  })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const result = await this.auth.verifyOtp(dto.email, dto.otp);
    return { ...result, message: 'OTP verified' };
  }

  @Public()
  @Post('token/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new access/refresh pair',
  })
  async refresh(@Body() dto: RefreshTokenDto) {
    const tokens = await this.auth.refresh(dto.refreshToken);
    return { ...tokens, message: 'Token refreshed' };
  }
}
