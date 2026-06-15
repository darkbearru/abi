import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { Injectable } from '@nestjs/common';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keyLength: number
) => Promise<Buffer>;

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16).toString('base64url');
    const key = await scryptAsync(password, salt, 64);

    return `scrypt$${salt}$${key.toString('base64url')}`;
  }

  async verify(password: string, passwordHash: string | null): Promise<boolean> {
    if (passwordHash === null) {
      return false;
    }

    const [scheme, salt, storedKey] = passwordHash.split('$');

    if (scheme !== 'scrypt' || !salt || !storedKey) {
      return false;
    }

    const actualKey = await scryptAsync(password, salt, 64);
    const expectedKey = Buffer.from(storedKey, 'base64url');

    return actualKey.byteLength === expectedKey.byteLength && timingSafeEqual(actualKey, expectedKey);
  }
}
