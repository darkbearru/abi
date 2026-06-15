<script setup lang="ts">
import type { SceneGenerationRequest, SceneGenerationResponse } from '@abi/shared';
import { computed, onMounted, ref } from 'vue';

import { scenesClient } from '../api';
import JobProgress from '../components/JobProgress.vue';
import PageHeader from '../components/PageHeader.vue';
import { useJobsStore } from '../stores/jobs';
import { useProjectsStore } from '../stores/projects';
import { useStylesStore } from '../stores/styles';

const projects = useProjectsStore();
const styles = useStylesStore();
const jobs = useJobsStore();

const text = ref('');
const styleId = ref('');
const timelineHint = ref('');
const aspectRatio = ref('16:9');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<SceneGenerationResponse | null>(null);

const canGenerate = computed(
  () => Boolean(projects.activeProjectId && text.value.trim() && styleId.value && !loading.value)
);

async function generate(): Promise<void> {
  if (!projects.activeProjectId || !canGenerate.value) {
    return;
  }

  loading.value = true;
  error.value = null;
  result.value = null;

  try {
    const trimmedTimelineHint = timelineHint.value.trim();
    const input: SceneGenerationRequest = trimmedTimelineHint
      ? {
          text: text.value.trim(),
          styleId: styleId.value,
          timelineHint: trimmedTimelineHint,
          aspectRatio: aspectRatio.value
        }
      : {
          text: text.value.trim(),
          styleId: styleId.value,
          aspectRatio: aspectRatio.value
        };

    const response = await scenesClient.generate(projects.activeProjectId, input);

    result.value = response;

    if (response.generationJobId) {
      await jobs.pollJob(response.generationJobId);
    }
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to generate scene';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  if (styles.status === 'idle') {
    await styles.loadStyles();
  }

  if (!styleId.value && styles.styles[0]) {
    styleId.value = styles.styles[0].id;
  }
});
</script>

<template>
  <PageHeader title="Scene Generator" eyebrow="Prompt to consistent image" />

  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
    <form class="space-y-4 rounded-md border border-slate-200 bg-white p-5" @submit.prevent="generate">
      <label class="block text-sm font-medium">
        Scene text
        <textarea
          v-model="text"
          rows="6"
          class="mt-2 block w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="John speaks with Michael near the fountain."
        />
      </label>

      <div class="grid gap-4 md:grid-cols-3">
        <label class="block text-sm font-medium">
          Style
          <select v-model="styleId" class="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="" disabled>Select style</option>
            <option v-for="style in styles.styles" :key="style.id" :value="style.id">
              {{ style.name }}
            </option>
          </select>
        </label>
        <label class="block text-sm font-medium">
          Timeline hint
          <input v-model="timelineHint" class="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
        </label>
        <label class="block text-sm font-medium">
          Aspect ratio
          <select v-model="aspectRatio" class="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option>16:9</option>
            <option>4:3</option>
            <option>1:1</option>
            <option>9:16</option>
          </select>
        </label>
      </div>

      <button
        class="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        :disabled="!canGenerate"
      >
        {{ loading ? 'Generating...' : 'Generate scene' }}
      </button>
      <p v-if="error" class="text-sm text-red-700">{{ error }}</p>
    </form>

    <aside class="space-y-4">
      <JobProgress
        v-if="result?.generationJobId"
        :job-id="result.generationJobId"
      />

      <section v-if="result" class="rounded-md border border-slate-200 bg-white p-4 text-sm">
        <h2 class="font-semibold">Result</h2>
        <p class="mt-2 text-slate-600">Status: {{ result.status }}</p>
        <p v-if="result.prompt" class="mt-3 text-slate-600">{{ result.prompt }}</p>

        <div v-if="result.missingReferences.length" class="mt-4">
          <p class="font-medium text-amber-800">Missing references</p>
          <pre class="mt-2 overflow-auto rounded bg-slate-100 p-3 text-xs">{{ result.missingReferences }}</pre>
        </div>

        <div v-if="result.candidates.length" class="mt-4">
          <p class="font-medium text-slate-900">Candidates</p>
          <pre class="mt-2 overflow-auto rounded bg-slate-100 p-3 text-xs">{{ result.candidates }}</pre>
        </div>
      </section>
    </aside>
  </div>
</template>
