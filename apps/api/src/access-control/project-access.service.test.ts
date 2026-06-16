import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../prisma/prisma.service.js';
import { ProjectAccessService } from './project-access.service.js';

describe('ProjectAccessService', () => {
  it('allows missing projects so downstream handlers can return not found', async () => {
    const prisma = {
      userBookProject: {
        findUnique: vi.fn().mockResolvedValue(null)
      }
    };
    const service = new ProjectAccessService(prisma as unknown as PrismaService);

    await expect(service.assertCanAccessProject('project-1', undefined)).resolves.toBeUndefined();
  });

  it('rejects owned projects when the current user does not match', async () => {
    const prisma = {
      userBookProject: {
        findUnique: vi.fn().mockResolvedValue({ userId: 'user-1' })
      }
    };
    const service = new ProjectAccessService(prisma as unknown as PrismaService);

    await expect(service.assertCanAccessProject('project-1', undefined)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('allows jobs owned by the current user', async () => {
    const prisma = {
      generationJob: {
        findUnique: vi.fn().mockResolvedValue({
          userId: null,
          project: { userId: 'user-1' }
        })
      }
    };
    const service = new ProjectAccessService(prisma as unknown as PrismaService);

    await expect(service.assertCanAccessJob('job-1', 'user-1')).resolves.toBeUndefined();
  });

  it('rejects jobs without owner context', async () => {
    const prisma = {
      generationJob: {
        findUnique: vi.fn().mockResolvedValue({
          userId: null,
          project: null
        })
      }
    };
    const service = new ProjectAccessService(prisma as unknown as PrismaService);

    await expect(service.assertCanAccessJob('job-1', 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('allows assets owned through their project', async () => {
    const prisma = {
      asset: {
        findUnique: vi.fn().mockResolvedValue({
          project: { userId: 'user-1' },
          scene: null,
          job: null
        })
      }
    };
    const service = new ProjectAccessService(prisma as unknown as PrismaService);

    await expect(service.assertCanAccessAsset('asset-1', 'user-1')).resolves.toBeUndefined();
  });

  it('rejects assets owned by another project user', async () => {
    const prisma = {
      asset: {
        findUnique: vi.fn().mockResolvedValue({
          project: { userId: 'user-2' },
          scene: null,
          job: null
        })
      }
    };
    const service = new ProjectAccessService(prisma as unknown as PrismaService);

    await expect(service.assertCanAccessAsset('asset-1', 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
