<script setup lang="ts">
import EntityCard from '../components/EntityCard.vue';
import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import { useActiveProjectEffect } from '../composables/useActiveProjectEffect';
import { useWorldBibleStore } from '../stores/worldBible';

const world = useWorldBibleStore();

useActiveProjectEffect((projectId) => world.loadProjectWorld(projectId));

function getObjectKind(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>).objectKind;

  return typeof value === 'string' && value.length > 0 ? value : null;
}
</script>

<template>
  <PageHeader title="Objects List" eyebrow="World Bible" />
  <ResourceState
    :status="world.status"
    :error="world.error"
    :empty="world.objects.length === 0"
    empty-text="No objects yet."
  >
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <EntityCard
        v-for="object in world.objects"
        :key="object.id"
        :title="object.name"
        :subtitle="object.description ?? null"
        :meta="[getObjectKind(object.metadata) ?? 'Object']"
        :to="`/objects/${object.id}`"
      />
    </div>
  </ResourceState>
</template>
