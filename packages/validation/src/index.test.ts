import { describe, expect, it } from 'vitest';

import { ValidationService, nonEmptyStringSchema } from './index.js';

describe('validation package', () => {
  it('rejects empty strings', () => {
    expect(nonEmptyStringSchema.safeParse('   ').success).toBe(false);
  });

  it('exposes a Nest injectable validation facade', () => {
    const service = new ValidationService();

    expect(service.parse(nonEmptyStringSchema, ' value ')).toBe('value');
    expect(service.safeParse(nonEmptyStringSchema, '').success).toBe(false);
  });
});
