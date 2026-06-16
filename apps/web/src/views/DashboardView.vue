<script setup lang="ts">
import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import StatCard from '../components/StatCard.vue';
import { useActiveProjectEffect } from '../composables/useActiveProjectEffect';
import { useProjectsStore } from '../stores/projects';
import { useWorldBibleStore } from '../stores/worldBible';

const projects = useProjectsStore();
const world = useWorldBibleStore();

useActiveProjectEffect((projectId) => world.loadProjectWorld(projectId));

function selectProject(projectId: string): void {
  projects.setActiveProject(projectId);
}
</script>

<template>
  <PageHeader title="Dashboard" eyebrow="Overview" />
  <ResourceState
    :status="projects.status"
    :error="projects.error"
    :empty="projects.projects.length === 0"
    empty-text="No projects yet."
  >
    <div class="grid gap-4 md:grid-cols-5">
      <StatCard label="Projects" :value="projects.projects.length" />
      <StatCard label="Characters" :value="world.characters.length" />
      <StatCard label="Locations" :value="world.locations.length" />
      <StatCard label="Objects" :value="world.objects.length" />
      <StatCard label="Timeline events" :value="world.timeline.length" />
    </div>
    <section class="mt-6 rounded-md border border-slate-200 bg-white">
      <div class="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Projects</div>
      <div class="divide-y divide-slate-100">
        <button
          v-for="project in projects.projects"
          :key="project.id"
          class="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50"
          :class="project.id === projects.activeProjectId ? 'bg-slate-100' : ''"
          @click="selectProject(project.id)"
        >
          <span class="font-medium">{{ project.name }}</span>
          <span class="text-slate-500">{{
            project.seriesTitle ?? project.bookTitle ?? project.id
          }}</span>
        </button>
      </div>
    </section>
  </ResourceState>
</template>
