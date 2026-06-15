<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  note?: string;
}>();
</script>

<template>
  <section class="rounded-md border border-slate-200 bg-white p-4">
    <p class="text-sm text-slate-500">{{ label }}</p>
    <p class="mt-2 text-2xl font-semibold text-slate-950">{{ value }}</p>
    <p v-if="note" class="mt-1 text-xs text-slate-500">{{ note }}</p>
  </section>
</template>
