<script setup lang="ts">
import { onMounted } from 'vue';

import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import StatCard from '../components/StatCard.vue';
import { useProjectsStore } from '../stores/projects';
import { useWorldBibleStore } from '../stores/worldBible';

const projects = useProjectsStore();
const world = useWorldBibleStore();

onMounted(() => {
  if (projects.activeProjectId) {
    void world.loadProjectWorld(projects.activeProjectId);
  }
});
</script>

<template>
  <PageHeader title="Project World Bible" eyebrow="Canon" />
  <ResourceState :status="world.status" :error="world.error">
    <div class="grid gap-4 md:grid-cols-3">
      <StatCard label="Characters" :value="world.characters.length" />
      <StatCard label="Locations" :value="world.locations.length" />
      <StatCard label="Timeline" :value="world.timeline.length" />
    </div>
  </ResourceState>
</template>
