import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { PatchCharacterDto } from './dto/patch-character.dto.js';

const CHARACTER_INCLUDE = {
  aliases: {
    orderBy: {
      alias: 'asc'
    }
  },
  versions: {
    orderBy: {
      version: 'asc'
    }
  }
} satisfies Prisma.CharacterInclude;

@Injectable()
export class CharactersQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectCharacters(projectId: string): Promise<readonly CharacterWithDetails[]> {
    const project = await this.prisma.userBookProject.findUnique({
      where: {
        id: projectId
      },
      select: {
        worldBible: {
          select: {
            id: true
          }
        },
        series: {
          select: {
            worldBible: {
              select: {
                id: true
              }
            }
          }
        },
        bookAnalysis: {
          select: {
            worldBible: {
              select: {
                id: true
              }
            }
          }
        }
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

    return this.prisma.character.findMany({
      where: {
        worldBibleId
      },
      include: CHARACTER_INCLUDE,
      orderBy: {
        canonicalName: 'asc'
      }
    });
  }

  async patchCharacter(
    characterId: string,
    dto: PatchCharacterDto
  ): Promise<CharacterWithDetails> {
    const existing = await this.prisma.character.findUnique({
      where: {
        id: characterId
      },
      include: CHARACTER_INCLUDE
    });

    if (!existing) {
      throw new NotFoundException('Character was not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.aliases) {
        await tx.characterAlias.deleteMany({
          where: {
            characterId
          }
        });
      }

      const updated = await tx.character.update({
        where: {
          id: characterId
        },
        data: {
          ...(dto.canonicalName === undefined
            ? {}
            : { canonicalName: dto.canonicalName }),
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
        include: CHARACTER_INCLUDE
      });

      if (dto.latestVersion) {
        const latestVersion = updated.versions.at(-1);

        if (latestVersion) {
          await tx.characterVersion.update({
            where: {
              id: latestVersion.id
            },
            data: {
              ...(dto.latestVersion.age === undefined
                ? {}
                : { age: dto.latestVersion.age }),
              ...(dto.latestVersion.appearance === undefined
                ? {}
                : { appearance: toInputJsonObject(dto.latestVersion.appearance) }),
              ...(dto.latestVersion.personality === undefined
                ? {}
                : { personality: toInputJsonObject(dto.latestVersion.personality) }),
              ...(dto.latestVersion.speechManner === undefined
                ? {}
                : { speechManner: dto.latestVersion.speechManner }),
              ...(dto.latestVersion.clothing === undefined
                ? {}
                : { clothing: toInputJsonObject(dto.latestVersion.clothing) }),
              ...(dto.latestVersion.timelineRange === undefined
                ? {}
                : { timelineRange: toInputJsonObject(dto.latestVersion.timelineRange) })
            }
          });
        }
      }

      return tx.character.findUniqueOrThrow({
        where: {
          id: characterId
        },
        include: CHARACTER_INCLUDE
      });
    });
  }
}

export type CharacterWithDetails = Prisma.CharacterGetPayload<{
  include: typeof CHARACTER_INCLUDE;
}>;

function uniqueAliases(aliases: readonly string[]): readonly string[] {
  return [...new Set(aliases.map((alias) => alias.trim()).filter(Boolean))];
}

function toInputJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, Prisma.InputJsonValue] =>
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
