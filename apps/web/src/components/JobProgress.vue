<script setup lang="ts">
import { computed } from 'vue';

import { useJobsStore } from '../stores/jobs';

const props = defineProps<{
  jobId?: string | null;
}>();

const jobs = useJobsStore();
const job = computed(() => (props.jobId ? jobs.jobs[props.jobId] : undefined));
const error = computed(() => (props.jobId ? jobs.errors[props.jobId] : undefined));
</script>

<template>
  <section v-if="jobId" class="rounded-md border border-slate-200 bg-white p-4">
    <div class="mb-2 flex justify-between text-sm">
      <span class="font-medium">Job {{ jobId }}</span>
      <span>{{ job?.status ?? 'Loading' }}</span>
    </div>
    <div class="h-2 overflow-hidden rounded bg-slate-100">
      <div class="h-full bg-slate-900" :style="{ width: `${job?.progress ?? 0}%` }" />
    </div>
    <p v-if="error" class="mt-2 text-sm text-red-700">{{ error }}</p>
  </section>
</template>
