import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'reader@example.com' })
  @IsEmail()
  @MaxLength(320)
  public readonly email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  public readonly password!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  public readonly name?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'reader@example.com' })
  @IsEmail()
  @MaxLength(320)
  public readonly email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  public readonly password!: string;
}

export class AuthUserDto {
  @ApiProperty()
  public readonly id!: string;

  @ApiProperty()
  public readonly email!: string;

  @ApiPropertyOptional({ nullable: true })
  public readonly name!: string | null;

  @ApiProperty({ enum: ['USER', 'ADMIN'] })
  public readonly role!: 'USER' | 'ADMIN';
}

export class AuthResponseDto {
  @ApiProperty()
  public readonly accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  public readonly tokenType!: 'Bearer';

  @ApiProperty()
  public readonly expiresInSeconds!: number;

  @ApiProperty({ type: AuthUserDto })
  public readonly user!: AuthUserDto;
}
