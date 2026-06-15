<script setup lang="ts">
import type { Asset, AsyncStatus } from '@abi/shared';
import { computed, onMounted, ref, watch } from 'vue';

import { assetsClient } from '../api';
import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import { useProjectsStore } from '../stores/projects';

const projects = useProjectsStore();
const status = ref<AsyncStatus>('idle');
const error = ref<string | null>(null);
const assets = ref<Asset[]>([]);

const projectId = computed(() => projects.activeProjectId);

async function loadAssets(): Promise<void> {
  if (!projectId.value) {
    assets.value = [];
    status.value = 'success';
    return;
  }

  status.value = 'loading';
  error.value = null;

  try {
    assets.value = [...(await assetsClient.list(projectId.value))];
    status.value = 'success';
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to load gallery';
    status.value = 'error';
  }
}

onMounted(loadAssets);
watch(projectId, loadAssets);
</script>

<template>
  <PageHeader title="Gallery" eyebrow="Generated assets" />
  <ResourceState
    :status="status"
    :error="error"
    :empty="assets.length === 0"
    empty-text="No generated assets yet."
  >
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <article v-for="asset in assets" :key="asset.id" class="overflow-hidden rounded-md border border-slate-200 bg-white">
        <img
          class="aspect-video w-full bg-slate-100 object-cover"
          :src="assetsClient.assetUrl(asset.localPath)"
          :alt="asset.prompt ?? asset.entityType ?? 'Generated asset'"
        >
        <div class="space-y-2 p-3 text-sm">
          <div class="flex items-center justify-between gap-2">
            <span class="truncate font-medium">{{ asset.entityType ?? 'Scene' }}</span>
            <span class="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500">
              {{ asset.approvalStatus ?? 'draft' }}
            </span>
          </div>
          <p v-if="asset.prompt" class="line-clamp-2 text-xs text-slate-600">{{ asset.prompt }}</p>
        </div>
      </article>
    </div>
  </ResourceState>
</template>
