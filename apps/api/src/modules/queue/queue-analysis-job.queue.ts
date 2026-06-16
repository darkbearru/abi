import { Injectable } from '@nestjs/common';

import { AnalysisJobQueue } from '../book-upload/ports/analysis-job.queue.js';
import type { EnqueueBookAnalysisInput } from '../book-upload/ports/analysis-job.queue.js';
import { QueueService } from './queue.service.js';

@Injectable()
export class QueueAnalysisJobQueue implements AnalysisJobQueue {
  constructor(private readonly queueService: QueueService) {}

  async enqueueBookAnalysis(input: EnqueueBookAnalysisInput): Promise<void> {
    await this.queueService.createJob({
      queueName: 'book-analysis',
      name: 'analyze-book',
      projectId: input.projectId,
      userId: input.userId,
      bookAnalysisId: input.bookAnalysisId,
      payload: {
        bookId: input.bookId,
        analysisId: input.bookAnalysisId,
        projectId: input.projectId,
        userId: input.userId
      }
    });
  }
}
