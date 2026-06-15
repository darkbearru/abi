import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { PatchLocationDto } from './dto/patch-location.dto.js';

const LOCATION_INCLUDE = {
  aliases: { orderBy: { alias: 'asc' } },
  versions: { orderBy: { version: 'asc' } },
  children: { select: { id: true, name: true } }
} satisfies Prisma.LocationInclude;

@Injectable()
export class LocationsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectLocations(projectId: string): Promise<readonly LocationWithDetails[]> {
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
      project.series?.worldBible?.id ?? project.worldBible?.id ?? project.bookAnalysis?.worldBible?.id;

    if (!worldBibleId) {
      return [];
    }

    return this.prisma.location.findMany({
      where: { worldBibleId },
      include: LOCATION_INCLUDE,
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }]
    });
  }

  async patchLocation(locationId: string, dto: PatchLocationDto): Promise<LocationWithDetails> {
    const existing = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: LOCATION_INCLUDE
    });

    if (!existing) {
      throw new NotFoundException('Location was not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.aliases) {
        await tx.locationAlias.deleteMany({ where: { locationId } });
      }

      const updated = await tx.location.update({
        where: { id: locationId },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.parentId === undefined ? {} : { parentId: dto.parentId }),
          ...(dto.aliases === undefined
            ? {}
            : {
                aliases: {
                  createMany: {
                    data: uniqueAliases(dto.aliases).map((alias) => ({ alias }))
                  }
                }
              })
        },
        include: LOCATION_INCLUDE
      });

      if (dto.latestVersion) {
        const latestVersion = updated.versions.at(-1);

        if (latestVersion) {
          await tx.locationVersion.update({
            where: { id: latestVersion.id },
            data: {
              ...(dto.latestVersion.description === undefined
                ? {}
                : { description: dto.latestVersion.description }),
              ...(dto.latestVersion.atmosphere === undefined
                ? {}
                : { atmosphere: toInputJsonObject(dto.latestVersion.atmosphere) }),
              ...(dto.latestVersion.palette === undefined
                ? {}
                : { palette: toInputJsonObject(dto.latestVersion.palette) }),
              ...(dto.latestVersion.era === undefined ? {} : { era: dto.latestVersion.era }),
              ...(dto.latestVersion.socialContext === undefined
                ? {}
                : { socialContext: toInputJsonObject(dto.latestVersion.socialContext) }),
              ...(dto.latestVersion.lightingRules === undefined
                ? {}
                : { lightingRules: toInputJsonObject(dto.latestVersion.lightingRules) }),
              ...(dto.latestVersion.architectureRules === undefined
                ? {}
                : {
                    architectureRules: toInputJsonObject(
                      dto.latestVersion.architectureRules
                    )
                  }),
              ...(dto.latestVersion.recurringObjects === undefined
                ? {}
                : {
                    recurringObjects: toInputJsonObject(
                      dto.latestVersion.recurringObjects
                    )
                  })
            }
          });
        }
      }

      return tx.location.findUniqueOrThrow({
        where: { id: locationId },
        include: LOCATION_INCLUDE
      });
    });
  }
}

export type LocationWithDetails = Prisma.LocationGetPayload<{
  include: typeof LOCATION_INCLUDE;
}>;

function uniqueAliases(aliases: readonly string[]): readonly string[] {
  return [...new Set(aliases.map((alias) => alias.trim()).filter(Boolean))];
}

function toInputJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, Prisma.InputJsonValue] =>
      isInputJsonValue(entry[1])
    )
  );
}

function isInputJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isInputJsonValue);
  }

  if (value && typeof value === 'object') {
    return Object.values(value).every(isInputJsonValue);
  }

  return false;
}
