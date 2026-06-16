<script setup lang="ts">
import { computed } from 'vue';

import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import { useActiveProjectEffect } from '../composables/useActiveProjectEffect';
import { useWorldBibleStore } from '../stores/worldBible';

const props = defineProps<{ id: string }>();
const world = useWorldBibleStore();
const object = computed(() => world.objects.find((item) => item.id === props.id) ?? null);

useActiveProjectEffect((projectId) => world.loadProjectWorld(projectId));

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'Unknown';
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}
</script>

<template>
  <PageHeader :title="object?.name ?? 'Object Detail'" eyebrow="Object" />
  <ResourceState
    :status="world.status"
    :error="world.error"
    :empty="!object"
    empty-text="Object was not found."
  >
    <section v-if="object" class="space-y-4">
      <article class="rounded-md border border-slate-200 bg-white p-4">
        <p class="text-sm text-slate-500">Description</p>
        <p class="mt-2 text-sm text-slate-700">{{ object.description ?? 'Unknown' }}</p>
      </article>

      <article class="rounded-md border border-slate-200 bg-white p-4">
        <p class="text-sm text-slate-500">Visual Prompt</p>
        <p class="mt-2 whitespace-pre-wrap text-sm text-slate-700">
          {{ object.visualPrompt ?? 'Unknown' }}
        </p>
      </article>

      <article class="rounded-md border border-slate-200 bg-white p-4">
        <p class="text-sm text-slate-500">Metadata</p>
        <pre class="mt-2 overflow-auto rounded bg-slate-50 p-3 text-xs">{{
          formatValue(object.metadata)
        }}</pre>
      </article>
    </section>
  </ResourceState>
</template>
