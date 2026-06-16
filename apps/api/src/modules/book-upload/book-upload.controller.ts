import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';

import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags
} from '@nestjs/swagger';

import { CurrentUser } from '../../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../../auth/auth.types.js';
import { getBookUploadConfig } from './book-upload.config.js';
import { BookFileValidator } from './book-file.validator.js';
import { BookUploadService } from './book-upload.service.js';
import { UploadBookDto } from './dto/upload-book.dto.js';
import { UploadBookResponseDto } from './dto/upload-book.response.dto.js';
import type { UploadedBookFile } from './book-upload.types.js';

interface MulterMemoryFile {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer?: Buffer;
  readonly path?: string;
}

@ApiTags('books')
@Controller('books')
export class BookUploadController {
  public constructor(
    private readonly bookUploadService: BookUploadService,
    private readonly bookFileValidator: BookFileValidator
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_request, _file, callback) => {
          const uploadTempRoot = getBookUploadTempRoot();

          mkdirSync(uploadTempRoot, { recursive: true });
          callback(null, uploadTempRoot);
        },
        filename: (_request, file, callback) => {
          callback(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
        }
      }),
      limits: {
        fileSize: getBookUploadConfig().maxFileSizeBytes,
        files: 1,
        fields: 3,
        fieldSize: getBookUploadConfig().maxFieldSizeBytes
      }
    })
  )
  @ApiOperation({ summary: 'Upload a source book file for analysis.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF, EPUB, TXT, or FB2 book file.'
        },
        title: {
          type: 'string'
        },
        author: {
          type: 'string'
        },
        language: {
          type: 'string'
        }
      }
    }
  })
  @ApiCreatedResponse({ type: UploadBookResponseDto })
  public async uploadBook(
    @UploadedFile() file: MulterMemoryFile | undefined,
    @Body() dto: UploadBookDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<UploadBookResponseDto> {
    if (!file) {
      throw new BadRequestException('Book file is required.');
    }

    const uploadedFile: UploadedBookFile = {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer ?? (await readFile(requireTempFilePath(file)))
    };

    try {
      this.bookFileValidator.validate(uploadedFile);

      return await this.bookUploadService.upload(uploadedFile, dto, user.id);
    } finally {
      await deleteTempFile(file.path);
    }
  }
}

function getBookUploadTempRoot(): string {
  return process.env.BOOK_UPLOAD_TEMP_ROOT ?? join(getBookUploadConfig().storageRoot, '.tmp', 'uploads');
}

function requireTempFilePath(file: MulterMemoryFile): string {
  if (!file.path) {
    throw new BadRequestException('Uploaded file payload is unavailable.');
  }

  return file.path;
}

async function deleteTempFile(path: string | undefined): Promise<void> {
  if (!path) {
    return;
  }

  try {
    await unlink(path);
  } catch {
    // Best-effort cleanup; failed uploads should not mask the original error.
  }
}
