import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { AnalysisJobQueue } from '../book-upload/ports/analysis-job.queue.js';
import { QUEUE_NAMES } from './queue.constants.js';
import { JobsController } from './jobs.controller.js';
import { QueueAnalysisJobQueue } from './queue-analysis-job.queue.js';
import { QueueService } from './queue.service.js';

@Module({
  imports: [
    PrismaModule,
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379'
      }
    }),
    BullModule.registerQueue(...QUEUE_NAMES.map((name) => ({ name })))
  ],
  controllers: [JobsController],
  providers: [
    QueueService,
    QueueAnalysisJobQueue,
    {
      provide: AnalysisJobQueue,
      useExisting: QueueAnalysisJobQueue
    }
  ],
  exports: [QueueService, AnalysisJobQueue]
})
export class QueueModule {}
