import type { Readable } from 'node:stream';

import { Injectable, NotFoundException } from '@nestjs/common';
import type { Asset } from '@prisma/client';

import { StorageService } from '@abi/storage';

import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  listProjectAssets(projectId: string): Promise<readonly Asset[]> {
    return this.prisma.asset.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getAssetFile(assetId: string): Promise<{
    readonly asset: Asset;
    readonly stream: Readable;
  }> {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });

    if (asset === null) {
      throw new NotFoundException('Asset was not found.');
    }

    return {
      asset,
      stream: await this.storage.read(asset.localPath)
    };
  }
}
