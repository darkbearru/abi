export const BOOK_UPLOAD_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/epub+zip',
  'text/plain',
  'application/x-fictionbook+xml',
  'text/xml',
  'application/xml'
]);

export const BOOK_UPLOAD_ALLOWED_EXTENSIONS = new Set(['.pdf', '.epub', '.txt', '.fb2']);

export const DEFAULT_MAX_BOOK_UPLOAD_BYTES = 50 * 1024 * 1024;
