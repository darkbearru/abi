<script setup lang="ts">
import { computed } from 'vue';

import PageHeader from '../components/PageHeader.vue';
import { useWorldBibleStore } from '../stores/worldBible';

const props = defineProps<{ id: string }>();
const world = useWorldBibleStore();
const character = computed(() => world.characters.find((item) => item.id === props.id) ?? null);
</script>

<template>
  <PageHeader :title="character?.canonicalName ?? 'Character Visual Passport'" eyebrow="References" />
  <section class="grid gap-4 md:grid-cols-3">
    <article
      v-for="type in ['front_view', 'side_view', 'back_view', 'portrait', 'emotion_sheet', 'outfit_sheet', 'pose_sheet']"
      :key="type"
      class="aspect-[4/3] rounded-md border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500"
    >
      {{ type }}
    </article>
  </section>
</template>
