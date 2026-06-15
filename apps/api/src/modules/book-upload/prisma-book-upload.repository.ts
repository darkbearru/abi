import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  BookAnalysisReference,
  CreateBookWithAnalysisInput
} from './book-upload.types.js';
import { BookUploadRepository } from './ports/book-upload.repository.js';

@Injectable()
export class PrismaBookUploadRepository implements BookUploadRepository {
  public constructor(private readonly prisma: PrismaService) {}

  public async findAnalysisByContentHash(
    contentHash: string
  ): Promise<BookAnalysisReference | null> {
    const analysis = await this.prisma.bookAnalysis.findFirst({
      where: {
        book: {
          contentHash
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        bookId: true
      }
    });

    if (!analysis) {
      return null;
    }

    return {
      bookId: analysis.bookId,
      bookAnalysisId: analysis.id
    };
  }

  public async createBookWithPendingAnalysis(
    input: CreateBookWithAnalysisInput
  ): Promise<BookAnalysisReference> {
    return this.prisma.$transaction(async (tx) => {
      const book = await tx.book.create({
        data: {
          title: input.title,
          ...(input.author === undefined ? {} : { author: input.author }),
          ...(input.language === undefined ? {} : { language: input.language }),
          fileHash: input.fileHash,
          contentHash: input.contentHash,
          files: {
            create: {
              kind: 'ORIGINAL',
              localPath: input.file.localPath,
              mimeType: input.file.mimeType,
              sizeBytes: input.file.sizeBytes,
              fileHash: input.file.fileHash
            }
          }
        }
      });
      const analysis = await tx.bookAnalysis.create({
        data: {
          bookId: book.id,
          status: 'PENDING',
          contentHash: input.contentHash
        }
      });

      return {
        bookId: book.id,
        bookAnalysisId: analysis.id
      };
    });
  }
}
