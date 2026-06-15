import { Injectable } from '@nestjs/common';

import type { ProjectSummary } from '@abi/shared';

import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async listUserProjects(userId: string): Promise<readonly ProjectSummary[]> {
    const projects = await this.prisma.userBookProject.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        book: {
          select: { title: true }
        },
        series: {
          select: { title: true }
        }
      }
    });

    return projects.map((project) => ({
      id: project.id,
      name: project.name,
      bookTitle: project.book.title,
      seriesTitle: project.series?.title ?? null,
      updatedAt: project.updatedAt.toISOString()
    }));
  }
}
