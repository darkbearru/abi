<script setup lang="ts">
import { onMounted } from 'vue';

import EntityCard from '../components/EntityCard.vue';
import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
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
  <PageHeader title="Characters List" eyebrow="World Bible" />
  <ResourceState :status="world.status" :error="world.error" :empty="world.characters.length === 0" empty-text="No characters yet.">
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <EntityCard
        v-for="character in world.characters"
        :key="character.id"
        :title="character.canonicalName"
        :subtitle="character.aliases.map((alias) => alias.alias).join(', ')"
        :meta="[`Versions: ${character.versions.length}`]"
        :to="`/characters/${character.id}`"
      />
    </div>
  </ResourceState>
</template>
