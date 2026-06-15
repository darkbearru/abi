<script setup lang="ts">
import { computed, ref } from 'vue';

import { booksClient } from '../api';
import PageHeader from '../components/PageHeader.vue';
import { useProjectsStore } from '../stores/projects';

const projects = useProjectsStore();

const file = ref<File | null>(null);
const title = ref('');
const seriesTitle = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<string | null>(null);

const canSubmit = computed(() => file.value !== null && !loading.value);

function onFileChange(event: Event): void {
  const target = event.target instanceof HTMLInputElement ? event.target : null;
  file.value = target?.files?.[0] ?? null;
}

async function submit(): Promise<void> {
  if (!file.value) {
    return;
  }

  loading.value = true;
  error.value = null;
  result.value = null;

  try {
    const form = new FormData();
    form.set('file', file.value);

    if (title.value.trim()) {
      form.set('title', title.value.trim());
    }

    if (seriesTitle.value.trim()) {
      form.set('seriesTitle', seriesTitle.value.trim());
    }

    const response = await booksClient.upload(form);
    await projects.loadProjects();
    projects.setActiveProject(response.projectId);

    result.value = response.existingAnalysisAvailable
      ? `Existing analysis reused for project: ${response.projectId}`
      : `Uploaded project: ${response.projectId}`;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Upload failed';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <PageHeader title="Upload Book / BookSeries" eyebrow="Ingestion" />
  <form class="max-w-2xl space-y-4 rounded-md border border-slate-200 bg-white p-5" @submit.prevent="submit">
    <label class="block text-sm font-medium">
      Book file
      <input
        class="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        type="file"
        accept=".pdf,.epub,.txt,.fb2"
        @change="onFileChange"
      >
    </label>
    <label class="block text-sm font-medium">
      Title
      <input v-model="title" class="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
    </label>
    <label class="block text-sm font-medium">
      Series
      <input v-model="seriesTitle" class="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
    </label>
    <button class="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" :disabled="!canSubmit">
      {{ loading ? 'Uploading...' : 'Upload' }}
    </button>
    <p v-if="error" class="text-sm text-red-700">{{ error }}</p>
    <p v-if="result" class="text-sm text-emerald-700">{{ result }}</p>
  </form>
</template>
