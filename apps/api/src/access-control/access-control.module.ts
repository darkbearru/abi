import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ProjectAccessGuard } from './project-access.guard.js';
import { ProjectAccessService } from './project-access.service.js';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [ProjectAccessGuard, ProjectAccessService],
  exports: [ProjectAccessGuard, ProjectAccessService]
})
export class AccessControlModule {}
