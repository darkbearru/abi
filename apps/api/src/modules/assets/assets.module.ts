import { StorageModule } from '@abi/storage';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { AssetsController } from './assets.controller.js';
import { AssetsService } from './assets.service.js';

@Module({
  imports: [
    PrismaModule,
    StorageModule.register({
      rootDir: process.env.STORAGE_ROOT ?? './storage'
    })
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService]
})
export class AssetsModule {}
