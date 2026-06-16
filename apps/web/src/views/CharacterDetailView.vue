<script setup lang="ts">
import type { Asset, CharacterVersion, GraphNode, ProjectGraph } from '@abi/shared';
import { computed, onMounted, ref } from 'vue';

import { assetsClient, projectsClient, visualPassportsClient } from '../api';
import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import { useActiveProjectEffect } from '../composables/useActiveProjectEffect';
import { useProjectsStore } from '../stores/projects';
import { useStylesStore } from '../stores/styles';
import { useWorldBibleStore } from '../stores/worldBible';
import {
  CHARACTER_PASSPORT_ASSET_TYPES,
  getCharacterVersionAssets,
  getPassportAssetType,
  isApprovedAsset
} from '../utils/characterVisualAssets';

const props = defineProps<{ id: string }>();
const projects = useProjectsStore();
const styles = useStylesStore();
const world = useWorldBibleStore();
const projectAssets = ref<Asset[]>([]);
const graph = ref<ProjectGraph | null>(null);
const graphError = ref<string | null>(null);
const generationStatus = ref<Record<string, 'idle' | 'generating' | 'ready' | 'approving' | 'approved'>>({});
const generationError = ref<Record<string, string | null>>({});
const character = computed(() => world.characters.find((item) => item.id === props.id) ?? null);
const effectiveStyleId = computed(() => projects.activeProject?.visualStyleId ?? styles.styles[0]?.id ?? '');
const graphLines = computed(() => (graph.value && character.value ? buildCharacterGraphLines(graph.value, character.value.id) : []));

useActiveProjectEffect(async (projectId) => {
  await Promise.all([
    world.loadProjectWorld(projectId),
    loadProjectAssets(projectId),
    loadCharacterGraph(projectId)
  ]);
});

async function loadProjectAssets(projectId: string): Promise<void> {
  projectAssets.value = [...(await assetsClient.list(projectId))];
}

async function loadCharacterGraph(projectId: string): Promise<void> {
  graphError.value = null;

  try {
    graph.value = await projectsClient.characterGraph(projectId, props.id);
  } catch (caught) {
    graph.value = null;
    graphError.value = caught instanceof Error ? caught.message : 'Unable to load character graph';
  }
}

async function generateVersionPassport(version: CharacterVersion): Promise<void> {
  if (!effectiveStyleId.value) {
    generationError.value = {
      ...generationError.value,
      [version.id]: 'Project style is missing.'
    };
    return;
  }

  generationStatus.value = { ...generationStatus.value, [version.id]: 'generating' };
  generationError.value = { ...generationError.value, [version.id]: null };

  try {
    await visualPassportsClient.generateCharacterReference(version.id, effectiveStyleId.value);

    if (projects.activeProjectId) {
      await loadProjectAssets(projects.activeProjectId);
    }
    generationStatus.value = { ...generationStatus.value, [version.id]: 'ready' };
  } catch (caught) {
    generationError.value = {
      ...generationError.value,
      [version.id]: caught instanceof Error ? caught.message : 'Unable to generate passport'
    };
    generationStatus.value = { ...generationStatus.value, [version.id]: 'idle' };
  }
}

async function approveAsset(versionId: string, assetId: string): Promise<void> {
  generationStatus.value = { ...generationStatus.value, [versionId]: 'approving' };
  generationError.value = { ...generationError.value, [versionId]: null };

  try {
    await visualPassportsClient.approveCharacterAsset(assetId);

    if (projects.activeProjectId) {
      await loadProjectAssets(projects.activeProjectId);
    }
    generationStatus.value = { ...generationStatus.value, [versionId]: 'approved' };
  } catch (caught) {
    generationError.value = {
      ...generationError.value,
      [versionId]: caught instanceof Error ? caught.message : 'Unable to approve asset'
    };
    generationStatus.value = { ...generationStatus.value, [versionId]: 'ready' };
  }
}

function versionAssets(version: CharacterVersion): readonly Asset[] {
  return getCharacterVersionAssets(projectAssets.value, version);
}

function missingAssetTypes(version: CharacterVersion): readonly string[] {
  const existingTypes = new Set(versionAssets(version).map(getPassportAssetType));

  return CHARACTER_PASSPORT_ASSET_TYPES.filter((assetType) => !existingTypes.has(assetType));
}

function assetImageUrl(assetId: string): string {
  return assetsClient.fileUrl(assetId);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'Unknown';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function buildCharacterGraphLines(graphValue: ProjectGraph, characterId: string): readonly string[] {
  const nodesById = new Map(graphValue.nodes.map((node) => [node.id, node]));
  const characterNode = graphValue.nodes.find((node) => node.properties.id === characterId);

  if (!characterNode) {
    return [];
  }

  return graphValue.relationships
    .filter((relationship) => relationship.source === characterNode.id || relationship.target === characterNode.id)
    .slice(0, 24)
    .map((relationship) => {
      const isOutgoing = relationship.source === characterNode.id;
      const otherNode = nodesById.get(isOutgoing ? relationship.target : relationship.source);
      const otherName = otherNode ? getNodeDisplayName(otherNode) : isOutgoing ? relationship.target : relationship.source;

      return `${formatRelationshipType(relationship.type, isOutgoing)} ${otherName}`;
    });
}

function getNodeDisplayName(node: GraphNode): string {
  const value =
    node.properties.canonicalName ??
    node.properties.name ??
    node.properties.title ??
    node.properties.id;

  return typeof value === 'string' ? value : node.id;
}

function formatRelationshipType(type: string, isOutgoing: boolean): string {
  const prefix = isOutgoing ? '' : 'related by';

  switch (type) {
    case 'KNOWS':
      return isOutgoing ? 'knows' : 'known by';
    case 'LOVES':
      return isOutgoing ? 'loves' : 'loved by';
    case 'HATES':
      return isOutgoing ? 'opposes' : 'opposed by';
    case 'VISITS':
      return isOutgoing ? 'visits' : 'visited by';
    case 'OWNS':
      return isOutgoing ? 'owns' : 'owned by';
    case 'APPEARS_IN':
      return isOutgoing ? 'appears in' : 'includes';
    case 'RELATED_TO':
      return 'related to';
    case 'VERSION_OF':
      return isOutgoing ? 'version of' : 'has version';
    default:
      return `${prefix} ${type.toLocaleLowerCase().replaceAll('_', ' ')}`.trim();
  }
}

onMounted(() => {
  if (styles.status === 'idle') {
    void styles.loadStyles();
  }
});
</script>

<template>
  <PageHeader :title="character?.canonicalName ?? 'Character Detail'" eyebrow="Character" />
  <ResourceState :status="world.status" :error="world.error" :empty="!character" empty-text="Character was not found.">
    <section v-if="character" class="space-y-4">
      <div class="rounded-md border border-slate-200 bg-white p-4">
        <p class="text-sm text-slate-500">Aliases</p>
        <p class="mt-1 text-sm">{{ character.aliases.map((alias) => alias.alias).join(', ') || 'None' }}</p>
      </div>
      <article v-for="version in character.versions" :key="version.id" class="rounded-md border border-slate-200 bg-white p-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h3 class="font-semibold">Version {{ version.version }}</h3>
          <button
            class="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            type="button"
            :disabled="generationStatus[version.id] === 'generating'"
            @click="generateVersionPassport(version)"
          >
            {{ generationStatus[version.id] === 'generating' ? 'Generating...' : 'Generate 4 views' }}
          </button>
        </div>

        <dl class="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <div><dt class="text-slate-500">Age</dt><dd>{{ version.age ?? 'Unknown' }}</dd></div>
          <div><dt class="text-slate-500">Speech</dt><dd>{{ version.speechManner ?? 'Unknown' }}</dd></div>
          <div><dt class="text-slate-500">Personality</dt><dd class="whitespace-pre-wrap">{{ formatValue(version.personality) }}</dd></div>
          <div><dt class="text-slate-500">Clothing</dt><dd class="whitespace-pre-wrap">{{ formatValue(version.clothing) }}</dd></div>
        </dl>

        <div class="mt-4">
          <p class="text-sm text-slate-500">Appearance</p>
          <pre class="mt-2 overflow-auto rounded bg-slate-50 p-3 text-xs">{{ formatValue(version.appearance) }}</pre>
        </div>

        <div class="mt-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm font-medium">Visual Passport</p>
            <p v-if="missingAssetTypes(version).length" class="text-xs text-amber-700">
              Missing: {{ missingAssetTypes(version).join(', ') }}
            </p>
          </div>
          <div v-if="versionAssets(version).length" class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article v-for="asset in versionAssets(version)" :key="asset.id" class="overflow-hidden rounded border border-slate-200">
              <img
                class="aspect-video w-full bg-slate-100 object-cover"
                :src="assetImageUrl(asset.id)"
                :alt="`${character.canonicalName} ${getPassportAssetType(asset) ?? 'asset'}`"
              >
              <div class="flex items-center justify-between gap-2 px-3 py-2">
                <span class="text-xs text-slate-600">{{ getPassportAssetType(asset) ?? 'asset' }} · {{ asset.approvalStatus }}</span>
                <button
                  class="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium disabled:opacity-40"
                  type="button"
                  :disabled="isApprovedAsset(asset) || generationStatus[version.id] === 'approving'"
                  @click="approveAsset(version.id, asset.id)"
                >
                  {{ isApprovedAsset(asset) ? 'Approved' : 'Approve' }}
                </button>
              </div>
            </article>
          </div>
          <div v-else class="mt-3 rounded border border-dashed border-slate-300 p-4 text-sm text-slate-500">
            No visual passport assets for this version yet.
          </div>
          <p v-if="generationError[version.id]" class="mt-2 text-xs text-red-700">
            {{ generationError[version.id] }}
          </p>
        </div>
      </article>

      <section class="rounded-md border border-slate-200 bg-white p-4">
        <h3 class="font-semibold">Knowledge Graph</h3>
        <p v-if="graphError" class="mt-2 text-sm text-red-700">{{ graphError }}</p>
        <ul v-else-if="graphLines.length" class="mt-3 space-y-1 text-sm">
          <li v-for="line in graphLines" :key="line" class="text-slate-700">
            <span class="text-slate-400">├──</span> {{ line }}
          </li>
        </ul>
        <p v-else class="mt-2 text-sm text-slate-500">No graph context for this character yet.</p>
      </section>
    </section>
  </ResourceState>
</template>
