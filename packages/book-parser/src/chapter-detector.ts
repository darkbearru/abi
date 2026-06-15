import type { ParsedChapter } from './types.js';

const CHAPTER_TITLE_PATTERNS = [
  /^(chapter|part|book)\s+([ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b[\s:.-]*(.*)$/i,
  /^(глава|часть)\s+([ivxlcdm]+|\d+|[а-яё]+)\b[\s:.-]*(.*)$/i,
  /^\d{1,3}[\s.:-]+[^\n]{1,120}$/
];

interface ChapterBoundary {
  readonly title: string;
  readonly offset: number;
}

export function detectChapters(normalizedText: string): readonly ParsedChapter[] {
  if (!normalizedText) {
    return [];
  }

  const boundaries = findChapterBoundaries(normalizedText);

  if (boundaries.length === 0) {
    return [
      {
        index: 0,
        text: normalizedText,
        startOffset: 0,
        endOffset: normalizedText.length
      }
    ];
  }

  return boundaries.map((boundary, index) => {
    const nextBoundary = boundaries[index + 1];
    const startOffset = boundary.offset;
    const endOffset = nextBoundary?.offset ?? normalizedText.length;
    const text = normalizedText.slice(startOffset, endOffset).trim();

    return {
      index,
      title: boundary.title,
      text,
      startOffset,
      endOffset
    };
  });
}

function findChapterBoundaries(text: string): readonly ChapterBoundary[] {
  const boundaries: ChapterBoundary[] = [];
  let offset = 0;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();

    if (isLikelyChapterTitle(trimmed)) {
      boundaries.push({
        title: trimmed,
        offset
      });
    }

    offset += line.length + 1;
  }

  if (boundaries.length <= 1) {
    return [];
  }

  return boundaries;
}

function isLikelyChapterTitle(line: string): boolean {
  if (line.length < 3 || line.length > 140) {
    return false;
  }

  return CHAPTER_TITLE_PATTERNS.some((pattern) => pattern.test(line));
}
