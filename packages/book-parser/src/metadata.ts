import type { BookParserMetadata } from './types.js';

export function compactMetadata(input: {
  readonly title: string | undefined;
  readonly author: string | undefined;
  readonly language: string | undefined;
}): BookParserMetadata {
  return {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.author === undefined ? {} : { author: input.author }),
    ...(input.language === undefined ? {} : { language: input.language })
  };
}
