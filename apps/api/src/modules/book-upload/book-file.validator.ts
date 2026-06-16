import { extname, normalize } from 'node:path';

import AdmZip from 'adm-zip';
import { Injectable, PayloadTooLargeException } from '@nestjs/common';

import {
  BOOK_UPLOAD_ALLOWED_EXTENSIONS,
  BOOK_UPLOAD_ALLOWED_MIME_TYPES
} from './book-upload.constants.js';
import { getBookUploadConfig } from './book-upload.config.js';
import { UnsupportedBookFileTypeException } from './book-upload.errors.js';
import type { UploadedBookFile } from './book-upload.types.js';

const MAX_EPUB_ENTRY_COUNT = 2_000;
const MAX_EPUB_ENTRY_NAME_LENGTH = 512;

@Injectable()
export class BookFileValidator {
  public validate(file: UploadedBookFile): void {
    const extension = extname(file.originalname).toLowerCase();

    if (
      !BOOK_UPLOAD_ALLOWED_EXTENSIONS.has(extension) ||
      !BOOK_UPLOAD_ALLOWED_MIME_TYPES.has(file.mimetype)
    ) {
      throw new UnsupportedBookFileTypeException();
    }

    if (!hasExpectedFileSignature(file, extension)) {
      throw new UnsupportedBookFileTypeException();
    }

    const { maxFileSizeBytes } = getBookUploadConfig();

    if (file.size > maxFileSizeBytes) {
      throw new PayloadTooLargeException(
        `Uploaded file exceeds ${String(maxFileSizeBytes)} bytes.`
      );
    }
  }
}

function hasExpectedFileSignature(file: UploadedBookFile, extension: string): boolean {
  if (extension === '.pdf' || file.mimetype === 'application/pdf') {
    return file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }

  if (extension === '.epub' || file.mimetype === 'application/epub+zip') {
    return isValidEpubArchive(file);
  }

  if (extension === '.fb2' || file.mimetype.includes('xml')) {
    return file.buffer.subarray(0, 2048).toString('utf8').includes('<FictionBook');
  }

  if (extension === '.txt' || file.mimetype === 'text/plain') {
    return !file.buffer.subarray(0, 1024).includes(0);
  }

  return false;
}

function isValidEpubArchive(file: UploadedBookFile): boolean {
  if (!file.buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    return false;
  }

  try {
    const zip = new AdmZip(file.buffer);
    const entries = zip.getEntries();

    if (
      entries.length === 0 ||
      entries.length > MAX_EPUB_ENTRY_COUNT ||
      entries.some((entry) => hasUnsafeZipEntryName(entry.entryName))
    ) {
      return false;
    }

    const totalUncompressedSize = entries.reduce(
      (sum, entry) => sum + entry.header.size,
      0
    );

    if (totalUncompressedSize > getBookUploadConfig().maxFileSizeBytes * 4) {
      return false;
    }

    const mimetypeEntry = zip.getEntry('mimetype');
    const hasEpubMimeType =
      mimetypeEntry?.getData().toString('utf8').trim() === 'application/epub+zip';
    const hasContainer = zip.getEntry('META-INF/container.xml') !== null;

    return hasEpubMimeType && hasContainer;
  } catch {
    return false;
  }
}

function hasUnsafeZipEntryName(entryName: string): boolean {
  const normalized = normalize(entryName).replaceAll('\\', '/');

  return (
    entryName.length === 0 ||
    entryName.length > MAX_EPUB_ENTRY_NAME_LENGTH ||
    normalized.startsWith('../') ||
    normalized === '..' ||
    normalized.includes('/../') ||
    normalized.startsWith('/')
  );
}
