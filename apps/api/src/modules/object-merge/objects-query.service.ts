import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ObjectsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectObjects(projectId: string): Promise<readonly ProjectWorldObject[]> {
    const project = await this.prisma.userBookProject.findUnique({
      where: { id: projectId },
      select: {
        worldBible: { select: { id: true } },
        series: { select: { worldBible: { select: { id: true } } } },
        bookAnalysis: { select: { worldBible: { select: { id: true } } } }
      }
    });

    if (!project) {
      throw new NotFoundException('Project was not found.');
    }

    const worldBibleId =
      project.series?.worldBible?.id ??
      project.worldBible?.id ??
      project.bookAnalysis?.worldBible?.id;

    if (!worldBibleId) {
      return [];
    }

    return this.prisma.worldObject.findMany({
      where: { worldBibleId },
      orderBy: { name: 'asc' }
    });
  }
}

export type ProjectWorldObject = Prisma.WorldObjectGetPayload<Record<string, never>>;
