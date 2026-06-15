import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

@Injectable()
export class BookHashService {
  public sha256(input: Buffer | string): string {
    return createHash('sha256').update(input).digest('hex');
  }
}
