import { PayloadTooLargeException } from '@nestjs/common';
import AdmZip from 'adm-zip';
import { describe, expect, it } from 'vitest';

import { BookFileValidator } from './book-file.validator.js';
import { UnsupportedBookFileTypeException } from './book-upload.errors.js';
import type { UploadedBookFile } from './book-upload.types.js';

describe('BookFileValidator', () => {
  const validator = new BookFileValidator();

  it('accepts valid text uploads', () => {
    expect(() => {
      validator.validate(upload('book.txt', 'text/plain', 'hello'));
    }).not.toThrow();
  });

  it('rejects mismatched PDF signatures', () => {
    expect(() => {
      validator.validate(upload('book.pdf', 'application/pdf', 'not a pdf'));
    }).toThrow(UnsupportedBookFileTypeException);
  });

  it('rejects binary text uploads', () => {
    expect(() => {
      validator.validate({
        originalname: 'book.txt',
        mimetype: 'text/plain',
        size: 3,
        buffer: Buffer.from([0x41, 0x00, 0x42])
      });
    }).toThrow(UnsupportedBookFileTypeException);
  });

  it('rejects oversize files', () => {
    expect(() => {
      validator.validate({
        originalname: 'book.txt',
        mimetype: 'text/plain',
        size: 51 * 1024 * 1024,
        buffer: Buffer.from('hello')
      });
    }).toThrow(PayloadTooLargeException);
  });

  it('rejects EPUB archives with unsafe entry names', () => {
    const zip = new AdmZip();

    zip.addFile('mimetype', Buffer.from('application/epub+zip'));
    zip.addFile('META-INF/container.xml', Buffer.from('<container />'));
    zip.addFile(`${'a'.repeat(513)}.txt`, Buffer.from('nope'));

    const buffer = zip.toBuffer();

    expect(() => {
      validator.validate({
        originalname: 'book.epub',
        mimetype: 'application/epub+zip',
        size: buffer.byteLength,
        buffer
      });
    }).toThrow(UnsupportedBookFileTypeException);
  });
});

function upload(originalname: string, mimetype: string, content: string): UploadedBookFile {
  const buffer = Buffer.from(content);

  return {
    originalname,
    mimetype,
    size: buffer.byteLength,
    buffer
  };
}
