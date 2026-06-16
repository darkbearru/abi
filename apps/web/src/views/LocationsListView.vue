<script setup lang="ts">
import EntityCard from '../components/EntityCard.vue';
import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import { useActiveProjectEffect } from '../composables/useActiveProjectEffect';
import { useWorldBibleStore } from '../stores/worldBible';

const world = useWorldBibleStore();

useActiveProjectEffect((projectId) => world.loadProjectWorld(projectId));
</script>

<template>
  <PageHeader title="Locations List" eyebrow="World Bible" />
  <ResourceState :status="world.status" :error="world.error" :empty="world.locations.length === 0" empty-text="No locations yet.">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <EntityCard
        v-for="location in world.locations"
        :key="location.id"
        :title="location.name"
        :subtitle="location.versions.at(-1)?.description ?? null"
        :meta="[location.parentId ? `Parent: ${location.parentId}` : 'Root']"
        :to="`/locations/${location.id}`"
      />
    </div>
  </ResourceState>
</template>
