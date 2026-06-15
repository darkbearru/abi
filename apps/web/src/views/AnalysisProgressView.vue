<script setup lang="ts">
import { ref } from 'vue';

import JobProgress from '../components/JobProgress.vue';
import PageHeader from '../components/PageHeader.vue';
import { useJobsStore } from '../stores/jobs';

const jobId = ref('');
const jobs = useJobsStore();

function startPolling(): void {
  if (jobId.value.trim()) {
    void jobs.pollJob(jobId.value.trim());
  }
}
</script>

<template>
  <PageHeader title="Analysis Progress" eyebrow="Jobs" />
  <section class="max-w-2xl rounded-md border border-slate-200 bg-white p-5">
    <div class="flex gap-2">
      <input v-model="jobId" class="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="Generation job id">
      <button class="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white" @click="startPolling">Track</button>
    </div>
    <div class="mt-4">
      <JobProgress :job-id="jobId" />
    </div>
  </section>
</template>
