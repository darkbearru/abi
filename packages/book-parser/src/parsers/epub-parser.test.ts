import AdmZip from 'adm-zip';
import { describe, expect, it } from 'vitest';

import { EpubParser } from './epub-parser.js';

describe('EpubParser', () => {
  it('parses html entries and metadata from a mock EPUB zip', async () => {
    const zip = new AdmZip();
    zip.addFile(
      'OPS/package.opf',
      Buffer.from(`<?xml version="1.0"?>
        <package>
          <metadata>
            <dc:title>Mock EPUB</dc:title>
            <dc:creator>A. Writer</dc:creator>
            <dc:language>en</dc:language>
          </metadata>
        </package>`)
    );
    zip.addFile(
      'OPS/chapter1.xhtml',
      Buffer.from('<html><body><h1>Chapter 1</h1><p>Hello&nbsp;EPUB</p></body></html>')
    );
    zip.addFile(
      'OPS/chapter2.xhtml',
      Buffer.from('<html><body><h1>Chapter 2</h1><p>Second &amp; final.</p></body></html>')
    );

    const parsed = await new EpubParser().parse(zip.toBuffer());

    expect(parsed.metadata).toMatchObject({
      title: 'Mock EPUB',
      author: 'A. Writer',
      language: 'en'
    });
    expect(parsed.normalizedText).toContain('Chapter 1');
    expect(parsed.normalizedText).toContain('Second & final.');
    expect(parsed.chapters).toHaveLength(2);
  });
});
