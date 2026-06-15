<script setup lang="ts">
defineProps<{
  title: string;
  eyebrow?: string;
  description?: string;
}>();
</script>

<template>
  <header class="mb-5 flex flex-col gap-2 border-b border-slate-200 pb-4">
    <p v-if="eyebrow" class="text-xs font-semibold uppercase tracking-wide text-slate-500">
      {{ eyebrow }}
    </p>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-2xl font-semibold tracking-normal text-slate-950">{{ title }}</h2>
        <p v-if="description" class="mt-1 max-w-3xl text-sm text-slate-600">{{ description }}</p>
      </div>
      <slot name="actions" />
    </div>
  </header>
</template>
