<script setup lang="ts">
import { computed } from 'vue';

import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import { useActiveProjectEffect } from '../composables/useActiveProjectEffect';
import { useWorldBibleStore } from '../stores/worldBible';

const world = useWorldBibleStore();

const events = computed(() =>
  [...world.timeline].sort((first, second) => first.relativeOrder - second.relativeOrder)
);

useActiveProjectEffect((projectId) => world.loadProjectWorld(projectId));
</script>

<template>
  <PageHeader title="Timeline" eyebrow="Narrative order" />
  <ResourceState
    :status="world.status"
    :error="world.error"
    :empty="events.length === 0"
    empty-text="No timeline events have been merged yet."
  >
    <ol class="space-y-3">
      <li
        v-for="event in events"
        :key="event.id"
        class="rounded-md border border-slate-200 bg-white p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-slate-950">{{ event.title }}</p>
            <p v-if="event.description" class="mt-1 text-sm text-slate-600">{{ event.description }}</p>
          </div>
          <div class="flex flex-wrap gap-2 text-xs text-slate-500">
            <span class="rounded border border-slate-200 px-2 py-1">Chapter {{ event.chapterIndex }}</span>
            <span class="rounded border border-slate-200 px-2 py-1">Order {{ event.relativeOrder }}</span>
            <span class="rounded border border-slate-200 px-2 py-1">
              {{ Math.round(event.confidence * 100) }}%
            </span>
          </div>
        </div>
      </li>
    </ol>
  </ResourceState>
</template>
