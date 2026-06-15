import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { CharacterMergeService } from './character-merge.service.js';
import { CharactersQueryService } from './characters-query.service.js';
import { CharactersController } from './characters.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [CharactersController],
  providers: [CharacterMergeService, CharactersQueryService],
  exports: [CharacterMergeService]
})
export class CharacterMergeModule {}
