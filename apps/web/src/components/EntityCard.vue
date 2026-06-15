<script setup lang="ts">
import { RouterLink } from 'vue-router';

defineProps<{
  title: string;
  subtitle?: string | null;
  meta?: readonly string[];
  to?: string;
}>();
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="block rounded-md border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
  >
    <h3 class="font-semibold text-slate-950">{{ title }}</h3>
    <p v-if="subtitle" class="mt-1 line-clamp-2 text-sm text-slate-600">{{ subtitle }}</p>
    <div v-if="meta?.length" class="mt-3 flex flex-wrap gap-2">
      <span
        v-for="item in meta"
        :key="item"
        class="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600"
      >
        {{ item }}
      </span>
    </div>
  </RouterLink>
  <article
    v-else
    class="block rounded-md border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
  >
    <h3 class="font-semibold text-slate-950">{{ title }}</h3>
    <p v-if="subtitle" class="mt-1 line-clamp-2 text-sm text-slate-600">{{ subtitle }}</p>
    <div v-if="meta?.length" class="mt-3 flex flex-wrap gap-2">
      <span
        v-for="item in meta"
        :key="item"
        class="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600"
      >
        {{ item }}
      </span>
    </div>
  </article>
</template>
