<script setup lang="ts">
import type { SceneGenerationRequest, SceneGenerationResponse } from '@abi/shared';
import { computed, onMounted, ref } from 'vue';

import { assetsClient, scenesClient, visualPassportsClient, type VisualPassportAsset } from '../api';
import JobProgress from '../components/JobProgress.vue';
import PageHeader from '../components/PageHeader.vue';
import { useJobsStore } from '../stores/jobs';
import { useProjectsStore } from '../stores/projects';
import { useStylesStore } from '../stores/styles';

const projects = useProjectsStore();
const styles = useStylesStore();
const jobs = useJobsStore();

const text = ref('');
const timelineHint = ref('');
const aspectRatio = ref('16:9');
const loading = ref(false);
const error = ref<string | null>(null);
const result = ref<SceneGenerationResponse | null>(null);
const referenceActionStatus = ref<Record<string, 'idle' | 'generating' | 'ready' | 'approving' | 'approved'>>({});
const referenceActionError = ref<Record<string, string | null>>({});
const generatedReferenceAssets = ref<Record<string, readonly VisualPassportAsset[]>>({});
const effectiveStyleId = computed(() => projects.activeProject?.visualStyleId ?? styles.styles[0]?.id ?? '');
const effectiveStyleName = computed(
  () => styles.styles.find((style) => style.id === effectiveStyleId.value)?.name ?? 'Default style'
);

const canGenerate = computed(
  () => Boolean(projects.activeProjectId && text.value.trim() && !loading.value)
);
const missingReferences = computed(() =>
  (result.value?.missingReferences ?? []).filter(isMissingReference)
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
          timelineHint: trimmedTimelineHint,
          aspectRatio: aspectRatio.value
        }
      : {
          text: text.value.trim(),
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

async function generateMissingReference(reference: MissingReference): Promise<void> {
  const key = missingReferenceKey(reference);

  if (!reference.versionId || !effectiveStyleId.value) {
    referenceActionError.value = {
      ...referenceActionError.value,
      [key]: 'Reference version or style is missing.'
    };
    return;
  }

  referenceActionStatus.value = { ...referenceActionStatus.value, [key]: 'generating' };
  referenceActionError.value = { ...referenceActionError.value, [key]: null };

  try {
    const response =
      reference.entityType === 'CHARACTER_VERSION'
        ? await visualPassportsClient.generateCharacterReference(reference.versionId, effectiveStyleId.value)
        : await visualPassportsClient.generateLocationReference(reference.versionId, effectiveStyleId.value);

    generatedReferenceAssets.value = {
      ...generatedReferenceAssets.value,
      [key]: response.assets
    };
    referenceActionStatus.value = { ...referenceActionStatus.value, [key]: 'ready' };
  } catch (caught) {
    referenceActionError.value = {
      ...referenceActionError.value,
      [key]: caught instanceof Error ? caught.message : 'Unable to generate reference'
    };
    referenceActionStatus.value = { ...referenceActionStatus.value, [key]: 'idle' };
  }
}

async function approveReferenceAsset(reference: MissingReference, assetId: string): Promise<void> {
  const key = missingReferenceKey(reference);

  referenceActionStatus.value = { ...referenceActionStatus.value, [key]: 'approving' };
  referenceActionError.value = { ...referenceActionError.value, [key]: null };

  try {
    const approvedAsset =
      reference.entityType === 'CHARACTER_VERSION'
        ? await visualPassportsClient.approveCharacterAsset(assetId)
        : await visualPassportsClient.approveLocationAsset(assetId);
    const assets = generatedReferenceAssets.value[key] ?? [];

    generatedReferenceAssets.value = {
      ...generatedReferenceAssets.value,
      [key]: assets.map((asset) => (asset.id === approvedAsset.id ? approvedAsset : asset))
    };
    referenceActionStatus.value = { ...referenceActionStatus.value, [key]: 'approved' };
  } catch (caught) {
    referenceActionError.value = {
      ...referenceActionError.value,
      [key]: caught instanceof Error ? caught.message : 'Unable to approve reference'
    };
    referenceActionStatus.value = { ...referenceActionStatus.value, [key]: 'ready' };
  }
}

function missingReferenceKey(reference: MissingReference): string {
  return `${reference.entityType}:${reference.versionId ?? reference.entityId}`;
}

function isMissingReference(value: unknown): value is MissingReference {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as Partial<MissingReference>).entityType === 'string' &&
    typeof (value as Partial<MissingReference>).entityId === 'string' &&
    typeof (value as Partial<MissingReference>).name === 'string'
  );
}

function assetImageUrl(assetId: string): string {
  return assetsClient.fileUrl(assetId);
}

interface MissingReference {
  readonly entityType: 'CHARACTER_VERSION' | 'LOCATION_VERSION';
  readonly entityId: string;
  readonly versionId?: string | null;
  readonly name: string;
  readonly reason: string;
}

onMounted(async () => {
  if (styles.status === 'idle') {
    await styles.loadStyles();
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
        <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <p class="text-xs font-medium uppercase text-slate-500">Project style</p>
          <p class="mt-1 font-medium text-slate-900">{{ effectiveStyleName }}</p>
        </div>
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

        <div v-if="missingReferences.length" class="mt-4 space-y-3">
          <p class="font-medium text-amber-800">Missing references</p>
          <article
            v-for="reference in missingReferences"
            :key="missingReferenceKey(reference)"
            class="rounded border border-amber-200 bg-amber-50 p-3"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-medium text-slate-950">{{ reference.name }}</p>
                <p class="mt-1 text-xs text-slate-600">{{ reference.entityType }}</p>
                <p class="mt-1 text-xs text-amber-800">{{ reference.reason }}</p>
              </div>
              <button
                class="shrink-0 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                type="button"
                :disabled="referenceActionStatus[missingReferenceKey(reference)] === 'generating'"
                @click="generateMissingReference(reference)"
              >
                {{ referenceActionStatus[missingReferenceKey(reference)] === 'generating' ? 'Generating...' : 'Generate draft' }}
              </button>
            </div>

            <p v-if="referenceActionError[missingReferenceKey(reference)]" class="mt-2 text-xs text-red-700">
              {{ referenceActionError[missingReferenceKey(reference)] }}
            </p>

            <div v-if="generatedReferenceAssets[missingReferenceKey(reference)]?.length" class="mt-3 space-y-2">
              <div
                v-for="asset in generatedReferenceAssets[missingReferenceKey(reference)]"
                :key="asset.id"
                class="overflow-hidden rounded border border-slate-200 bg-white"
              >
                <img
                  class="aspect-video w-full bg-slate-100 object-cover"
                  :src="assetImageUrl(asset.id)"
                  :alt="`${reference.name} ${asset.passportAssetType}`"
                >
                <div class="flex items-center justify-between gap-3 px-3 py-2">
                  <span class="text-xs text-slate-600">{{ asset.passportAssetType }} · {{ asset.approvalStatus }}</span>
                  <button
                    class="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                    type="button"
                    :disabled="asset.approvalStatus === 'approved' || referenceActionStatus[missingReferenceKey(reference)] === 'approving'"
                    @click="approveReferenceAsset(reference, asset.id)"
                  >
                    {{ asset.approvalStatus === 'approved' ? 'Approved' : 'Approve' }}
                  </button>
                </div>
              </div>
              <p class="text-xs text-slate-500">After approving all missing references, run scene generation again.</p>
            </div>
          </article>
        </div>

        <div v-if="result.candidates.length" class="mt-4">
          <p class="font-medium text-slate-900">Candidates</p>
          <pre class="mt-2 overflow-auto rounded bg-slate-100 p-3 text-xs">{{ result.candidates }}</pre>
        </div>

        <div v-if="result.createSuggestions.length" class="mt-4">
          <p class="font-medium text-slate-900">Unresolved entities</p>
          <pre class="mt-2 overflow-auto rounded bg-slate-100 p-3 text-xs">{{ result.createSuggestions }}</pre>
        </div>
      </section>
    </aside>
  </div>
</template>
