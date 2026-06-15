<script setup lang="ts">
import type { VisualStyle } from '@abi/shared';
import { onMounted } from 'vue';

import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import { useStylesStore } from '../stores/styles';

const styles = useStylesStore();

function styleColors(style: VisualStyle): readonly string[] {
  return [style.primaryColor, style.secondaryColor, style.accentColor].filter(
    (color): color is string => typeof color === 'string' && color.length > 0
  );
}

onMounted(() => {
  if (styles.status === 'idle') {
    void styles.loadStyles();
  }
});
</script>

<template>
  <PageHeader title="Visual Styles" eyebrow="Presets" />
  <ResourceState
    :status="styles.status"
    :error="styles.error"
    :empty="styles.styles.length === 0"
    empty-text="No visual style presets are available."
  >
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article v-for="style in styles.styles" :key="style.id" class="rounded-md border border-slate-200 bg-white p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold">{{ style.name }}</h2>
            <p v-if="style.slug" class="mt-1 text-xs text-slate-500">{{ style.slug }}</p>
          </div>
          <div class="flex gap-1">
            <span
              v-for="color in styleColors(style)"
              :key="color"
              class="h-5 w-5 rounded border border-slate-200"
              :style="{ backgroundColor: color }"
            />
          </div>
        </div>
        <p v-if="style.prompt" class="mt-4 line-clamp-4 text-sm text-slate-600">{{ style.prompt }}</p>
      </article>
    </div>
  </ResourceState>
</template>
