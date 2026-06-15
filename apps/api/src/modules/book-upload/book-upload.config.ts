import { DEFAULT_MAX_BOOK_UPLOAD_BYTES } from './book-upload.constants.js';

interface BookUploadConfig {
  readonly maxFileSizeBytes: number;
  readonly storageRoot: string;
}

export function getBookUploadConfig(): BookUploadConfig {
  return {
    maxFileSizeBytes: Number(process.env.BOOK_UPLOAD_MAX_BYTES ?? DEFAULT_MAX_BOOK_UPLOAD_BYTES),
    storageRoot: process.env.STORAGE_ROOT ?? './storage'
  };
}
