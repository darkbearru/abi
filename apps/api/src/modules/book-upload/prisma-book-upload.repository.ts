import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

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
      const project = await this.createProject(tx, {
        userId: input.userId,
        bookId: book.id,
        bookAnalysisId: analysis.id,
        title: input.title,
        ...(input.seriesTitle === undefined ? {} : { seriesTitle: input.seriesTitle })
      });

      return {
        bookId: book.id,
        bookAnalysisId: analysis.id,
        projectId: project.id
      };
    });
  }

  public async createProjectForAnalysis(input: {
    readonly userId: string;
    readonly bookId: string;
    readonly bookAnalysisId: string;
    readonly title: string;
    readonly seriesTitle?: string;
  }): Promise<{ readonly projectId: string }> {
    const project = await this.prisma.$transaction((tx) => this.createProject(tx, input));

    return { projectId: project.id };
  }

  private async createProject(
    tx: Prisma.TransactionClient,
    input: {
      readonly userId: string;
      readonly bookId: string;
      readonly bookAnalysisId: string;
      readonly title: string;
      readonly seriesTitle?: string;
    }
  ): Promise<{ readonly id: string }> {
    const seriesId =
      input.seriesTitle === undefined
        ? undefined
        : await this.findOrCreateSeries(tx, input.userId, input.bookId, input.seriesTitle);

    return tx.userBookProject.create({
      data: {
        userId: input.userId,
        bookId: input.bookId,
        bookAnalysisId: input.bookAnalysisId,
        ...(seriesId === undefined ? {} : { seriesId }),
        name: input.title,
        books: {
          create: {
            bookId: input.bookId,
            bookAnalysisId: input.bookAnalysisId,
            orderIndex: 0
          }
        }
      },
      select: { id: true }
    });
  }

  private async findOrCreateSeries(
    tx: Prisma.TransactionClient,
    userId: string,
    bookId: string,
    title: string
  ): Promise<string> {
    const normalizedTitle = title.trim();
    const series = await tx.bookSeries.upsert({
      where: {
        userId_title: {
          userId,
          title: normalizedTitle
        }
      },
      create: {
        userId,
        title: normalizedTitle
      },
      update: {},
      select: { id: true }
    });
    const existingLink = await tx.bookSeriesBook.findUnique({
      where: {
        seriesId_bookId: {
          seriesId: series.id,
          bookId
        }
      },
      select: { id: true }
    });

    if (existingLink === null) {
      const booksInSeries = await tx.bookSeriesBook.count({
        where: { seriesId: series.id }
      });

      await tx.bookSeriesBook.create({
        data: {
          seriesId: series.id,
          bookId,
          orderIndex: booksInSeries
        }
      });
    }

    return series.id;
  }
}
