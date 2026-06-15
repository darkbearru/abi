import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service.js';
import { getAuthConfig } from './auth.config.js';
import type { AuthenticatedUser } from './auth.types.js';
import type { AuthResponseDto, LoginDto, RegisterDto } from './dto/auth.dto.js';
import { JwtTokenService } from './jwt-token.service.js';
import { PasswordService } from './password.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: JwtTokenService
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = normalizeEmail(dto.email);
    const passwordHash = await this.passwords.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
          passwordHash
        },
        select: AUTH_USER_SELECT
      });

      return this.issueToken(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('User with this email already exists.');
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user: AuthUserWithPassword | null = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(dto.email) },
      select: AUTH_USER_WITH_PASSWORD_SELECT
    });

    if (user === null || !(await this.passwords.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name
    };

    return this.issueToken(authenticatedUser);
  }

  async getUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: AUTH_USER_SELECT
    });

    if (user === null) {
      throw new UnauthorizedException('User no longer exists.');
    }

    return user;
  }

  issueToken(user: AuthenticatedUser): AuthResponseDto {
    return {
      accessToken: this.tokens.sign(user),
      tokenType: 'Bearer',
      expiresInSeconds: getAuthConfig().jwtExpiresInSeconds,
      user
    };
  }
}

const AUTH_USER_SELECT = {
  id: true,
  email: true,
  name: true
} satisfies Prisma.UserSelect;

const AUTH_USER_WITH_PASSWORD_SELECT = {
  ...AUTH_USER_SELECT,
  passwordHash: true
} satisfies Prisma.UserSelect;

type AuthUserWithPassword = Prisma.UserGetPayload<{
  select: typeof AUTH_USER_WITH_PASSWORD_SELECT;
}>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
