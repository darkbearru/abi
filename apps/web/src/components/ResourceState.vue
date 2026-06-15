<script setup lang="ts">
import type { AsyncStatus } from '@abi/shared';

defineProps<{
  status: AsyncStatus;
  error?: string | null;
  empty?: boolean;
  emptyText?: string;
}>();
</script>

<template>
  <div v-if="status === 'loading'" class="rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600">
    Loading...
  </div>
  <div v-else-if="status === 'error'" class="rounded-md border border-red-200 bg-red-50 p-6 text-sm text-red-700">
    {{ error ?? 'Something went wrong.' }}
  </div>
  <div v-else-if="empty" class="rounded-md border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
    {{ emptyText ?? 'No records yet.' }}
  </div>
  <slot v-else />
</template>
