import { Injectable } from '@nestjs/common';

import type { EnqueueBookAnalysisInput } from './ports/analysis-job.queue.js';
import { AnalysisJobQueue } from './ports/analysis-job.queue.js';

@Injectable()
export class InMemoryAnalysisJobQueue implements AnalysisJobQueue {
  public readonly jobs: EnqueueBookAnalysisInput[] = [];

  public enqueueBookAnalysis(input: EnqueueBookAnalysisInput): Promise<void> {
    this.jobs.push(input);

    return Promise.resolve();
  }
}
