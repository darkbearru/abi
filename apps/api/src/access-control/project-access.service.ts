import { ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanAccessProject(projectId: string, userId: string | undefined): Promise<void> {
    const project = await this.prisma.userBookProject.findUnique({
      where: { id: projectId },
      select: { userId: true }
    });

    if (project === null || project.userId === userId) {
      return;
    }

    throw new ForbiddenException('Project access denied.');
  }

  async assertCanAccessJob(jobId: string, userId: string | undefined): Promise<void> {
    const job = await this.prisma.generationJob.findUnique({
      where: { id: jobId },
      select: {
        userId: true,
        project: {
          select: { userId: true }
        }
      }
    });

    if (job === null) {
      return;
    }

    const ownerIds = [job.userId, ...(job.project?.userId ? [job.project.userId] : [])];

    if (ownerIds.includes(userId ?? '')) {
      return;
    }

    throw new ForbiddenException('Job access denied.');
  }

  async assertCanAccessAsset(assetId: string, userId: string | undefined): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        project: { select: { userId: true } },
        scene: { select: { project: { select: { userId: true } } } },
        job: { select: { userId: true, project: { select: { userId: true } } } }
      }
    });

    if (asset === null) {
      return;
    }

    this.assertOwner(
      [
        asset.project?.userId,
        asset.scene?.project.userId,
        asset.job?.userId,
        asset.job?.project?.userId
      ],
      userId,
      'Asset access denied.'
    );
  }

  async assertCanAccessCharacter(characterId: string, userId: string | undefined): Promise<void> {
    const character = await this.prisma.character.findUnique({
      where: { id: characterId },
      select: WORLD_BIBLE_OWNER_SELECT
    });

    if (character === null) {
      return;
    }

    this.assertCanAccessWorldBibleOwners(character.worldBible, userId, 'Character access denied.');
  }

  async assertCanAccessCharacterVersion(
    characterVersionId: string,
    userId: string | undefined
  ): Promise<void> {
    const characterVersion = await this.prisma.characterVersion.findUnique({
      where: { id: characterVersionId },
      select: {
        character: {
          select: WORLD_BIBLE_OWNER_SELECT
        }
      }
    });

    if (characterVersion === null) {
      return;
    }

    this.assertCanAccessWorldBibleOwners(
      characterVersion.character.worldBible,
      userId,
      'Character version access denied.'
    );
  }

  async assertCanAccessLocation(locationId: string, userId: string | undefined): Promise<void> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: WORLD_BIBLE_OWNER_SELECT
    });

    if (location === null) {
      return;
    }

    this.assertCanAccessWorldBibleOwners(location.worldBible, userId, 'Location access denied.');
  }

  async assertCanAccessLocationVersion(
    locationVersionId: string,
    userId: string | undefined
  ): Promise<void> {
    const locationVersion = await this.prisma.locationVersion.findUnique({
      where: { id: locationVersionId },
      select: {
        location: {
          select: WORLD_BIBLE_OWNER_SELECT
        }
      }
    });

    if (locationVersion === null) {
      return;
    }

    this.assertCanAccessWorldBibleOwners(
      locationVersion.location.worldBible,
      userId,
      'Location version access denied.'
    );
  }

  private assertCanAccessWorldBibleOwners(
    worldBible: WorldBibleOwnerSource,
    userId: string | undefined,
    message: string
  ): void {
    this.assertOwner(
      [
        worldBible.project?.userId,
        worldBible.series?.userId,
        ...(worldBible.bookAnalysis?.projects.map((project) => project.userId) ?? [])
      ],
      userId,
      message
    );
  }

  private assertOwner(
    ownerIds: readonly (string | null | undefined)[],
    userId: string | undefined,
    message: string
  ): void {
    const normalizedOwnerIds = ownerIds.filter(
      (ownerId): ownerId is string => ownerId !== null && ownerId !== undefined
    );

    if (normalizedOwnerIds.includes(userId ?? '')) {
      return;
    }

    throw new ForbiddenException(message);
  }
}

const WORLD_BIBLE_OWNER_SELECT = {
  worldBible: {
    select: {
      project: {
        select: { userId: true }
      },
      series: {
        select: { userId: true }
      },
      bookAnalysis: {
        select: {
          projects: {
            select: { userId: true }
          }
        }
      }
    }
  }
} as const;

interface WorldBibleOwnerSource {
  readonly project: { readonly userId: string } | null;
  readonly series: { readonly userId: string | null } | null;
  readonly bookAnalysis: {
    readonly projects: readonly { readonly userId: string }[];
  } | null;
}
