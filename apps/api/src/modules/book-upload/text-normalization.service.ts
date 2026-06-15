import { normalizeBookText } from '@abi/book-parser';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TextNormalizationService {
  public normalize(input: string): string {
    return normalizeBookText(input);
  }
}
