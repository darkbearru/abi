import { Injectable, Module } from '@nestjs/common';
import { z } from 'zod';
import type { SafeParseReturnType, ZodType } from 'zod';

export const nonEmptyStringSchema = z.string().trim().min(1);

export type NonEmptyString = z.infer<typeof nonEmptyStringSchema>;

@Injectable()
export class ValidationService {
  parse<T>(schema: ZodType<T>, value: unknown): T {
    return schema.parse(value);
  }

  safeParse<T>(
    schema: ZodType<T>,
    value: unknown
  ): SafeParseReturnType<unknown, T> {
    return schema.safeParse(value);
  }
}

@Module({
  providers: [ValidationService],
  exports: [ValidationService]
})
export class ValidationModule {}
