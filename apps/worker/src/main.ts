import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { WorkerModule } from './worker.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();

  const keepAlive = setInterval(() => undefined, 60_000);

  await new Promise<void>((resolve) => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });

  clearInterval(keepAlive);
  await app.close();
}

void bootstrap();
