import { StorageModule } from '@abi/storage';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { LocalLocationPassportStorageProvider } from './local-location-passport-storage.provider.js';
import { LocationPromptBuilderService } from './location-prompt-builder.service.js';
import { LocationVisualPassportController } from './location-visual-passport.controller.js';
import { LocationVisualPassportService } from './location-visual-passport.service.js';

@Module({
  imports: [
    PrismaModule,
    StorageModule.register({
      provider: new LocalLocationPassportStorageProvider()
    })
  ],
  controllers: [LocationVisualPassportController],
  providers: [LocationPromptBuilderService, LocationVisualPassportService],
  exports: [LocationPromptBuilderService, LocationVisualPassportService]
})
export class LocationVisualPassportModule {}
