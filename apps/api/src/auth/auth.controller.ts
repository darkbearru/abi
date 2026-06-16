import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { CurrentUser } from './current-user.decorator.js';
import { clearAuthCookie, createCsrfToken, setAuthCookies } from './auth-cookie.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import { AuthResponseDto, AuthUserDto, LoginDto, RegisterDto } from './dto/auth.dto.js';
import { Public } from './public.decorator.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiCreatedResponse({ type: AuthResponseDto })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponseDto> {
    const authResponse = await this.auth.register(dto);

    setAuthCookies(response, {
      accessToken: authResponse.accessToken,
      csrfToken: createCsrfToken(),
      maxAgeSeconds: authResponse.expiresInSeconds
    });

    return authResponse;
  }

  @Public()
  @Post('login')
  @ApiOkResponse({ type: AuthResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponseDto> {
    const authResponse = await this.auth.login(dto, getClientIp(request));

    setAuthCookies(response, {
      accessToken: authResponse.accessToken,
      csrfToken: createCsrfToken(),
      maxAgeSeconds: authResponse.expiresInSeconds
    });

    return authResponse;
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    clearAuthCookie(response);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuthUserDto })
  me(@CurrentUser() user: AuthenticatedUser): AuthUserDto {
    return user;
  }
}

function getClientIp(request: Request): string | undefined {
  const forwardedFor = request.header('x-forwarded-for')?.split(',')[0]?.trim();

  return forwardedFor && forwardedFor.length > 0 ? forwardedFor : request.ip;
}
