<script setup lang="ts">
import type { Asset, Character } from '@abi/shared';
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { assetsClient, visualPassportsClient } from '../api';
import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import { useActiveProjectEffect } from '../composables/useActiveProjectEffect';
import { useProjectsStore } from '../stores/projects';
import { useStylesStore } from '../stores/styles';
import { useWorldBibleStore } from '../stores/worldBible';
import { getCharacterPortraitAsset, isApprovedAsset } from '../utils/characterVisualAssets';

const world = useWorldBibleStore();
const projects = useProjectsStore();
const styles = useStylesStore();
const generationStatus = ref<Record<string, 'idle' | 'generating' | 'ready' | 'approving' | 'approved'>>({});
const generationError = ref<Record<string, string | null>>({});
const projectAssets = ref<Asset[]>([]);
const effectiveStyleId = computed(() => projects.activeProject?.visualStyleId ?? styles.styles[0]?.id ?? '');

useActiveProjectEffect(async (projectId) => {
  await Promise.all([world.loadProjectWorld(projectId), loadProjectAssets(projectId)]);
});

async function loadProjectAssets(projectId: string): Promise<void> {
  projectAssets.value = [...(await assetsClient.list(projectId))];
}

async function generateCharacterPassport(character: Character): Promise<void> {
  if (character.versions.length === 0 || !effectiveStyleId.value) {
    generationError.value = {
      ...generationError.value,
      [character.id]: 'Character versions or project style are missing.'
    };
    return;
  }

  generationStatus.value = { ...generationStatus.value, [character.id]: 'generating' };
  generationError.value = { ...generationError.value, [character.id]: null };

  try {
    for (const version of character.versions) {
      await visualPassportsClient.generateCharacterReference(version.id, effectiveStyleId.value);
    }

    if (projects.activeProjectId) {
      await loadProjectAssets(projects.activeProjectId);
    }
    generationStatus.value = { ...generationStatus.value, [character.id]: 'ready' };
  } catch (caught) {
    generationError.value = {
      ...generationError.value,
      [character.id]: caught instanceof Error ? caught.message : 'Unable to generate portrait'
    };
    generationStatus.value = { ...generationStatus.value, [character.id]: 'idle' };
  }
}

async function approveCharacterAsset(characterId: string, assetId: string): Promise<void> {
  generationStatus.value = { ...generationStatus.value, [characterId]: 'approving' };
  generationError.value = { ...generationError.value, [characterId]: null };

  try {
    await visualPassportsClient.approveCharacterAsset(assetId);

    if (projects.activeProjectId) {
      await loadProjectAssets(projects.activeProjectId);
    }
    generationStatus.value = { ...generationStatus.value, [characterId]: 'approved' };
  } catch (caught) {
    generationError.value = {
      ...generationError.value,
      [characterId]: caught instanceof Error ? caught.message : 'Unable to approve portrait'
    };
    generationStatus.value = { ...generationStatus.value, [characterId]: 'ready' };
  }
}

function assetImageUrl(assetId: string): string {
  return assetsClient.fileUrl(assetId);
}

function portraitAsset(character: Character): Asset | null {
  return getCharacterPortraitAsset(projectAssets.value, character);
}

onMounted(() => {
  if (styles.status === 'idle') {
    void styles.loadStyles();
  }
});
</script>

<template>
  <PageHeader title="Characters List" eyebrow="World Bible" />
  <ResourceState :status="world.status" :error="world.error" :empty="world.characters.length === 0" empty-text="No characters yet.">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="character in world.characters"
        :key="character.id"
        class="overflow-hidden rounded-md border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm"
      >
        <RouterLink :to="`/characters/${character.id}`" class="block">
          <img
            v-if="portraitAsset(character)"
            class="aspect-video w-full bg-slate-100 object-cover"
            :src="assetImageUrl(portraitAsset(character)?.id ?? '')"
            :alt="`${character.canonicalName} portrait`"
          >
          <div v-else class="flex aspect-video w-full items-center justify-center bg-slate-100 text-xs text-slate-500">
            No portrait
          </div>
          <div class="p-4">
          <h3 class="font-semibold text-slate-950">{{ character.canonicalName }}</h3>
          <p v-if="character.aliases.length" class="mt-1 line-clamp-2 text-sm text-slate-600">
            {{ character.aliases.map((alias) => alias.alias).join(', ') }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <span class="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600">
              Versions: {{ character.versions.length }}
            </span>
            <span v-if="portraitAsset(character)" class="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600">
              {{ isApprovedAsset(portraitAsset(character)!) ? 'Approved portrait' : 'Draft portrait' }}
            </span>
          </div>
          </div>
        </RouterLink>

        <div class="flex items-center justify-between gap-3 border-t border-slate-100 p-4">
          <button
            class="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            type="button"
            :disabled="generationStatus[character.id] === 'generating'"
            @click="generateCharacterPassport(character)"
          >
            {{ generationStatus[character.id] === 'generating' ? 'Generating...' : 'Generate passport' }}
          </button>
          <button
            v-if="portraitAsset(character) && !isApprovedAsset(portraitAsset(character)!)"
            class="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium disabled:opacity-40"
            type="button"
            :disabled="generationStatus[character.id] === 'approving'"
            @click="approveCharacterAsset(character.id, portraitAsset(character)!.id)"
          >
            Approve portrait
          </button>
          <p v-if="generationError[character.id]" class="text-xs text-red-700">
            {{ generationError[character.id] }}
          </p>
        </div>
      </article>
    </div>
  </ResourceState>
</template>
