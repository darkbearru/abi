<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';

import JobProgress from '../components/JobProgress.vue';
import PageHeader from '../components/PageHeader.vue';
import { useJobsStore } from '../stores/jobs';
import { useProjectsStore } from '../stores/projects';

const jobs = useJobsStore();
const projects = useProjectsStore();
const activeProject = computed(() => projects.activeProject);
const activeProjectId = computed(() => projects.activeProjectId);
const projectJobs = computed(() => {
  if (!activeProjectId.value) {
    return [];
  }

  return (jobs.projectJobs[activeProjectId.value] ?? [])
    .map((jobId) => jobs.jobs[jobId])
    .filter((job) => job !== undefined);
});
const isAnalysisRunning = computed(() => projectJobs.value.some(isActiveAnalysisJob));
const canStart = computed(() =>
  Boolean(
    activeProjectId.value &&
      !isAnalysisRunning.value &&
      jobs.startStatus !== 'loading' &&
      jobs.stopStatus !== 'loading'
  )
);
const canStop = computed(() =>
  Boolean(activeProjectId.value && isAnalysisRunning.value && jobs.stopStatus !== 'loading')
);

onMounted(async () => {
  if (projects.status === 'idle') {
    await projects.loadProjects();
  }

  await loadActiveProjectJobs();
});

watch(activeProjectId, () => {
  void loadActiveProjectJobs();
});

async function loadActiveProjectJobs(): Promise<void> {
  if (activeProjectId.value) {
    await jobs.loadProjectJobs(activeProjectId.value);
  }
}

async function startAnalysis(): Promise<void> {
  if (activeProjectId.value) {
    await jobs.startProjectAnalysis(activeProjectId.value);
  }
}

async function stopAnalysis(): Promise<void> {
  if (activeProjectId.value) {
    await jobs.stopProjectAnalysis(activeProjectId.value);
  }
}

function isActiveAnalysisJob(job: { readonly queueName?: string; readonly status: string }): boolean {
  return (
    (job.queueName === 'book-analysis' ||
      job.queueName === 'chunk-extraction' ||
      job.queueName === 'entity-merge') &&
    (job.status === 'QUEUED' || job.status === 'PROCESSING')
  );
}

function formatDate(value?: string): string {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
</script>

<template>
  <PageHeader title="Analysis Progress" eyebrow="Jobs" />

  <section class="max-w-4xl rounded-md border border-slate-200 bg-white p-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-sm text-slate-500">Active project</p>
        <h2 class="text-lg font-semibold text-slate-950">{{ activeProject?.name ?? 'No project selected' }}</h2>
      </div>
      <button
        v-if="isAnalysisRunning"
        class="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-40"
        :disabled="!canStop"
        @click="stopAnalysis"
      >
        {{ jobs.stopStatus === 'loading' ? 'Stopping...' : 'Stop analysis' }}
      </button>
      <button
        v-else
        class="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        :disabled="!canStart"
        @click="startAnalysis"
      >
        {{ jobs.startStatus === 'loading' ? 'Starting...' : 'Start / retry analysis' }}
      </button>
    </div>

    <p v-if="jobs.startError" class="mt-3 text-sm text-red-700">{{ jobs.startError }}</p>
    <p v-if="jobs.stopError" class="mt-3 text-sm text-red-700">{{ jobs.stopError }}</p>
    <p v-if="jobs.projectError" class="mt-3 text-sm text-red-700">{{ jobs.projectError }}</p>

    <div class="mt-5 space-y-3">
      <div v-if="jobs.projectStatus === 'loading'" class="text-sm text-slate-500">Loading jobs...</div>
      <div v-else-if="projectJobs.length === 0" class="text-sm text-slate-500">No analysis jobs yet.</div>
      <article
        v-for="job in projectJobs"
        :key="job.id"
        class="rounded-md border border-slate-200 p-4"
      >
        <div class="mb-3 flex flex-wrap items-start justify-between gap-2 text-sm">
          <div>
            <p class="font-medium text-slate-950">{{ job.name ?? job.queueName ?? 'analysis job' }}</p>
            <p class="text-xs text-slate-500">{{ job.id }}</p>
          </div>
          <div class="text-right">
            <p class="font-medium text-slate-700">{{ job.status }}</p>
            <p class="text-xs text-slate-500">{{ formatDate(job.updatedAt) }}</p>
          </div>
        </div>
        <JobProgress :job-id="job.id" />
        <pre
          v-if="job.error"
          class="mt-3 max-h-40 overflow-auto rounded bg-red-50 p-3 text-xs text-red-800"
        >{{ formatJson(job.error) }}</pre>
      </article>
    </div>
  </section>
</template>
