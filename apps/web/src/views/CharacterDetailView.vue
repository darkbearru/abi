<script setup lang="ts">
import { computed, onMounted } from 'vue';

import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import { useProjectsStore } from '../stores/projects';
import { useWorldBibleStore } from '../stores/worldBible';

const props = defineProps<{ id: string }>();
const projects = useProjectsStore();
const world = useWorldBibleStore();
const character = computed(() => world.characters.find((item) => item.id === props.id) ?? null);

onMounted(() => {
  if (projects.activeProjectId && world.characters.length === 0) {
    void world.loadProjectWorld(projects.activeProjectId);
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
        <h3 class="font-semibold">Version {{ version.version }}</h3>
        <dl class="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <div><dt class="text-slate-500">Age</dt><dd>{{ version.age ?? 'Unknown' }}</dd></div>
          <div><dt class="text-slate-500">Speech</dt><dd>{{ version.speechManner ?? 'Unknown' }}</dd></div>
        </dl>
        <pre class="mt-3 overflow-auto rounded bg-slate-50 p-3 text-xs">{{ version.appearance }}</pre>
      </article>
    </section>
  </ResourceState>
</template>
