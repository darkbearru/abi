import { StorageModule } from '@abi/storage';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { CharacterVisualPassportController } from './character-visual-passport.controller.js';
import { CharacterVisualPassportService } from './character-visual-passport.service.js';
import { LocalPassportStorageProvider } from './local-passport-storage.provider.js';
import { PromptBuilderService } from './prompt-builder.service.js';

@Module({
  imports: [
    PrismaModule,
    StorageModule.register({
      provider: new LocalPassportStorageProvider()
    })
  ],
  controllers: [CharacterVisualPassportController],
  providers: [PromptBuilderService, CharacterVisualPassportService],
  exports: [PromptBuilderService, CharacterVisualPassportService]
})
export class CharacterVisualPassportModule {}
