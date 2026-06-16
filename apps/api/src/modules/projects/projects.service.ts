import { Injectable, NotFoundException } from '@nestjs/common';

import type { ProjectSummary } from '@abi/shared';

import { PrismaService } from '../../prisma/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';
import type { QueueJobResponse } from '../queue/queue.types.js';
import type { UpdateProjectSettingsDto } from './dto/update-project-settings.dto.js';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService
  ) {}

  async listUserProjects(userId: string): Promise<readonly ProjectSummary[]> {
    const projects = await this.prisma.userBookProject.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        visualStyleId: true,
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
      visualStyleId: project.visualStyleId,
      bookTitle: project.book.title,
      seriesTitle: project.series?.title ?? null,
      updatedAt: project.updatedAt.toISOString()
    }));
  }

  async updateSettings(
    userId: string,
    projectId: string,
    dto: UpdateProjectSettingsDto
  ): Promise<ProjectSummary> {
    if (dto.visualStyleId) {
      const visualStyle = await this.prisma.visualStyle.findUnique({
        where: { id: dto.visualStyleId },
        select: { id: true }
      });

      if (!visualStyle) {
        throw new NotFoundException('Visual style was not found.');
      }
    }

    const existingProject = await this.prisma.userBookProject.findFirst({
      where: { id: projectId, userId },
      select: { id: true }
    });

    if (!existingProject) {
      throw new NotFoundException('Project was not found.');
    }

    const project = await this.prisma.userBookProject.update({
      where: { id: existingProject.id },
      data: {
        visualStyleId: dto.visualStyleId ?? null
      },
      select: {
        id: true,
        name: true,
        visualStyleId: true,
        updatedAt: true,
        book: {
          select: { title: true }
        },
        series: {
          select: { title: true }
        }
      }
    });

    return {
      id: project.id,
      name: project.name,
      visualStyleId: project.visualStyleId,
      bookTitle: project.book.title,
      seriesTitle: project.series?.title ?? null,
      updatedAt: project.updatedAt.toISOString()
    };
  }

  async startAnalysis(userId: string, projectId: string): Promise<QueueJobResponse> {
    const project = await this.prisma.userBookProject.findFirst({
      where: { id: projectId, userId },
      select: {
        id: true,
        userId: true,
        bookId: true,
        bookAnalysisId: true
      }
    });

    if (!project || !project.bookAnalysisId) {
      throw new NotFoundException('Project analysis was not found.');
    }

    const activeJob = (await this.queueService.getProjectJobs(project.id)).find(
      (job) =>
        job.bookAnalysisId === project.bookAnalysisId &&
        isAnalysisQueue(job.queueName) &&
        (job.status === 'QUEUED' || job.status === 'PROCESSING')
    );

    if (activeJob) {
      return activeJob;
    }

    return this.queueService.createJob({
      queueName: 'book-analysis',
      name: 'analyze-book',
      projectId: project.id,
      userId: project.userId,
      bookAnalysisId: project.bookAnalysisId,
      payload: {
        bookId: project.bookId,
        analysisId: project.bookAnalysisId,
        projectId: project.id,
        userId: project.userId
      }
    });
  }

  async stopAnalysis(
    userId: string,
    projectId: string
  ): Promise<readonly QueueJobResponse[]> {
    const project = await this.prisma.userBookProject.findFirst({
      where: { id: projectId, userId },
      select: { id: true, bookAnalysisId: true }
    });

    if (!project || !project.bookAnalysisId) {
      throw new NotFoundException('Project analysis was not found.');
    }

    const activeJobs = (await this.queueService.getProjectJobs(project.id)).filter(
      (job) =>
        job.bookAnalysisId === project.bookAnalysisId &&
        isAnalysisQueue(job.queueName) &&
        (job.status === 'QUEUED' || job.status === 'PROCESSING')
    );

    return Promise.all(activeJobs.map((job) => this.queueService.cancelJob(job.id)));
  }
}

function isAnalysisQueue(queueName: string): boolean {
  return (
    queueName === 'book-analysis' ||
    queueName === 'chunk-extraction' ||
    queueName === 'entity-merge'
  );
}
