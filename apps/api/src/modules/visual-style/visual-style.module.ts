import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { StyleAbstractionService } from './style-abstraction.service.js';
import { VisualStyleController } from './visual-style.controller.js';
import { VisualStyleService } from './visual-style.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [VisualStyleController],
  providers: [VisualStyleService, StyleAbstractionService],
  exports: [VisualStyleService, StyleAbstractionService]
})
export class VisualStyleModule {}
