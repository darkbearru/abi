import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { ObjectsQueryService } from './objects-query.service.js';
import { ObjectsController } from './objects.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [ObjectsController],
  providers: [ObjectsQueryService],
  exports: [ObjectsQueryService]
})
export class ObjectMergeModule {}
