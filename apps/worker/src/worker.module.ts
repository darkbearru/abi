import { AiCoreModule } from '@abi/ai-core';
import { BookParserModule } from '@abi/book-parser';
import { PromptsModule } from '@abi/prompts';
import { StorageModule } from '@abi/storage';
import { ValidationModule } from '@abi/validation';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { CharacterExtractionModule } from './modules/character-extraction/character-extraction.module.js';
import { LocationExtractionModule } from './modules/location-extraction/location-extraction.module.js';
import { TimelineExtractionModule } from './modules/timeline-extraction/timeline-extraction.module.js';
import { QueueModule } from './modules/queue/queue.module.js';

@Module({
  imports: [
    AiCoreModule.register(
      process.env.OPENAI_API_KEY
        ? {
            openAi: {
              apiKey: process.env.OPENAI_API_KEY
            }
          }
        : {}
    ),
    BookParserModule,
    PromptsModule,
    StorageModule,
    ValidationModule,
    QueueModule,
    CharacterExtractionModule,
    LocationExtractionModule,
    TimelineExtractionModule,
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379'
      }
    })
  ]
})
export class WorkerModule {}
