import { describe, expect, it } from 'vitest';

import { BookHashService } from './book-hash.service.js';

describe('BookHashService', () => {
  it('calculates SHA-256 hashes', () => {
    const service = new BookHashService();

    expect(service.sha256('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    );
  });
});
