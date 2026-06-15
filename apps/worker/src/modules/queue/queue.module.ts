import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { QUEUE_NAMES } from './queue.constants.js';
import { queueProcessors } from './queue.processors.js';

@Module({
  imports: [PrismaModule, BullModule.registerQueue(...QUEUE_NAMES.map((name) => ({ name })))],
  providers: process.env.ENABLE_PLACEHOLDER_QUEUE_PROCESSORS === 'true' ? [...queueProcessors] : []
})
export class QueueModule {}
