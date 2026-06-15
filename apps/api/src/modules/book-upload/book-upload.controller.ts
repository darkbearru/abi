import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  readonly buffer: Buffer;
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
      limits: {
        fileSize: getBookUploadConfig().maxFileSizeBytes
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
  public uploadBook(
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
      buffer: file.buffer
    };

    this.bookFileValidator.validate(uploadedFile);

    return this.bookUploadService.upload(uploadedFile, dto, user.id);
  }
}
