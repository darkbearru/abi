<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';

import { useAuthStore } from '../stores/auth';
import { useProjectsStore } from '../stores/projects';

const projects = useProjectsStore();
const auth = useAuthStore();
const router = useRouter();

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/upload', label: 'Upload' },
  { to: '/analysis', label: 'Analysis' },
  { to: '/world-bible', label: 'World Bible' },
  { to: '/characters', label: 'Characters' },
  { to: '/locations', label: 'Locations' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/graph', label: 'Graph' },
  { to: '/styles', label: 'Styles' },
  { to: '/scene-generator', label: 'Scene Generator' },
  { to: '/gallery', label: 'Gallery' }
] as const;

const activeProjectLabel = computed(() => projects.activeProject?.name ?? 'No project');

function onProjectChange(event: Event): void {
  const target = event.target instanceof HTMLSelectElement ? event.target : null;

  if (target?.value) {
    projects.setActiveProject(target.value);
  }
}

async function logout(): Promise<void> {
  await auth.logout();
  projects.clearProjects();
  await router.replace({ name: 'login' });
}

onMounted(() => {
  if (projects.status === 'idle') {
    void projects.loadProjects();
  }
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-950">
    <aside class="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
      <div class="mb-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">AI Book Illustrator</p>
        <p class="mt-2 truncate text-lg font-semibold">{{ activeProjectLabel }}</p>
      </div>

      <nav class="space-y-1">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          active-class="bg-slate-900 text-white hover:bg-slate-900"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <div class="lg:pl-64">
      <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Workspace</p>
            <h1 class="text-lg font-semibold">{{ activeProjectLabel }}</h1>
          </div>
          <select
            class="w-56 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            :value="projects.activeProjectId ?? ''"
            @change="onProjectChange"
          >
            <option value="" disabled>Select project</option>
            <option v-for="project in projects.projects" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>
          <button class="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium" type="button" @click="logout">
            Sign out
          </button>
        </div>
      </header>

      <main class="mx-auto max-w-7xl px-4 py-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
