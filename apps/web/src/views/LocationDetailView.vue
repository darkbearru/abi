<script setup lang="ts">
import { computed, onMounted } from 'vue';

import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import { useProjectsStore } from '../stores/projects';
import { useWorldBibleStore } from '../stores/worldBible';

const props = defineProps<{ id: string }>();
const projects = useProjectsStore();
const world = useWorldBibleStore();
const location = computed(() => world.locations.find((item) => item.id === props.id) ?? null);

onMounted(() => {
  if (projects.activeProjectId && world.locations.length === 0) {
    void world.loadProjectWorld(projects.activeProjectId);
  }
});
</script>

<template>
  <PageHeader :title="location?.name ?? 'Location Detail'" eyebrow="Location" />
  <ResourceState :status="world.status" :error="world.error" :empty="!location" empty-text="Location was not found.">
    <section v-if="location" class="space-y-4">
      <article v-for="version in location.versions" :key="version.id" class="rounded-md border border-slate-200 bg-white p-4">
        <h3 class="font-semibold">Version {{ version.version }}</h3>
        <p class="mt-2 text-sm text-slate-700">{{ version.description }}</p>
        <pre class="mt-3 overflow-auto rounded bg-slate-50 p-3 text-xs">{{ version.palette }}</pre>
      </article>
    </section>
  </ResourceState>
</template>
