import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { VisualStyle } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateVisualStyleDto, UpdateVisualStyleDto } from './dto/visual-style.dto.js';

interface StyleControlData {
  readonly primaryColor?: string;
  readonly secondaryColor?: string;
  readonly accentColor?: string;
  readonly contrastLevel?: number;
  readonly saturationLevel?: number;
  readonly grainLevel?: number;
  readonly lineThickness?: number;
}

@Injectable()
export class VisualStyleService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<readonly VisualStyle[]> {
    return this.prisma.visualStyle.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
    });
  }

  async get(id: string): Promise<VisualStyle> {
    const style = await this.prisma.visualStyle.findUnique({ where: { id } });

    if (!style) {
      throw new NotFoundException('Visual style was not found.');
    }

    return style;
  }

  async create(dto: CreateVisualStyleDto): Promise<VisualStyle> {
    const slug = dto.slug ? normalizeSlug(dto.slug) : normalizeSlug(dto.name);

    try {
      return await this.prisma.visualStyle.create({
        data: {
          slug,
          name: dto.name,
          ...(dto.description === undefined ? {} : { description: dto.description }),
          prompt: dto.prompt,
          ...(dto.negativePrompt === undefined
            ? {}
            : { negativePrompt: dto.negativePrompt }),
          ...toStyleControlData(dto),
          ...(dto.isDefault === undefined ? {} : { isDefault: dto.isDefault })
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Visual style slug already exists.');
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateVisualStyleDto): Promise<VisualStyle> {
    await this.get(id);

    try {
      return await this.prisma.visualStyle.update({
        where: { id },
        data: {
          ...(dto.slug === undefined ? {} : { slug: normalizeSlug(dto.slug) }),
          ...(dto.name === undefined ? {} : { name: dto.name }),
          ...(dto.description === undefined ? {} : { description: dto.description }),
          ...(dto.prompt === undefined ? {} : { prompt: dto.prompt }),
          ...(dto.negativePrompt === undefined
            ? {}
            : { negativePrompt: dto.negativePrompt }),
          ...toStyleControlData(dto),
          ...(dto.isDefault === undefined ? {} : { isDefault: dto.isDefault })
        }
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Visual style slug already exists.');
      }

      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.visualStyle.delete({ where: { id } });
  }
}

function toStyleControlData(
  dto: Pick<
    CreateVisualStyleDto,
    | 'primaryColor'
    | 'secondaryColor'
    | 'accentColor'
    | 'contrastLevel'
    | 'saturationLevel'
    | 'grainLevel'
    | 'lineThickness'
  >
): StyleControlData {
  return {
    ...(dto.primaryColor === undefined ? {} : { primaryColor: dto.primaryColor }),
    ...(dto.secondaryColor === undefined ? {} : { secondaryColor: dto.secondaryColor }),
    ...(dto.accentColor === undefined ? {} : { accentColor: dto.accentColor }),
    ...(dto.contrastLevel === undefined ? {} : { contrastLevel: dto.contrastLevel }),
    ...(dto.saturationLevel === undefined
      ? {}
      : { saturationLevel: dto.saturationLevel }),
    ...(dto.grainLevel === undefined ? {} : { grainLevel: dto.grainLevel }),
    ...(dto.lineThickness === undefined ? {} : { lineThickness: dto.lineThickness })
  };
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { readonly code?: unknown }).code === 'P2002'
  );
}
