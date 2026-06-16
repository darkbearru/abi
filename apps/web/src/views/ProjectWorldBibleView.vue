<script setup lang="ts">
import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import StatCard from '../components/StatCard.vue';
import { useActiveProjectEffect } from '../composables/useActiveProjectEffect';
import { useWorldBibleStore } from '../stores/worldBible';

const world = useWorldBibleStore();

useActiveProjectEffect((projectId) => world.loadProjectWorld(projectId));
</script>

<template>
  <PageHeader title="Project World Bible" eyebrow="Canon" />
  <ResourceState :status="world.status" :error="world.error">
    <div class="grid gap-4 md:grid-cols-4">
      <StatCard label="Characters" :value="world.characters.length" />
      <StatCard label="Locations" :value="world.locations.length" />
      <StatCard label="Objects" :value="world.objects.length" />
      <StatCard label="Timeline" :value="world.timeline.length" />
    </div>
  </ResourceState>
</template>
