<script setup lang="ts">
import { computed, onMounted } from 'vue';

import PageHeader from '../components/PageHeader.vue';
import ResourceState from '../components/ResourceState.vue';
import StatCard from '../components/StatCard.vue';
import { useProjectsStore } from '../stores/projects';
import { useWorldBibleStore } from '../stores/worldBible';

const projects = useProjectsStore();
const world = useWorldBibleStore();

const graph = computed(() => world.graph);

onMounted(async () => {
  if (projects.activeProjectId) {
    await world.loadGraph(projects.activeProjectId);
  }
});
</script>

<template>
  <PageHeader title="Knowledge Graph" eyebrow="Entity network" />
  <ResourceState
    :status="world.status"
    :error="world.error"
    :empty="!graph || graph.nodes.length === 0"
    empty-text="No graph data has been synchronized yet."
  >
    <div v-if="graph" class="space-y-6">
      <div class="grid gap-4 md:grid-cols-2">
        <StatCard label="Nodes" :value="graph.nodes.length" />
        <StatCard label="Relationships" :value="graph.relationships.length" />
      </div>

      <section class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-md border border-slate-200 bg-white">
          <div class="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Nodes</div>
          <div class="max-h-96 divide-y divide-slate-100 overflow-auto">
            <div v-for="node in graph.nodes" :key="node.id" class="px-4 py-3 text-sm">
              <p class="font-medium">{{ node.properties.name ?? node.properties.title ?? node.id }}</p>
              <p class="mt-1 text-xs text-slate-500">{{ node.labels.join(', ') }}</p>
            </div>
          </div>
        </div>

        <div class="rounded-md border border-slate-200 bg-white">
          <div class="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Relationships</div>
          <div class="max-h-96 divide-y divide-slate-100 overflow-auto">
            <div v-for="relationship in graph.relationships" :key="relationship.id" class="px-4 py-3 text-sm">
              <p class="font-medium">{{ relationship.type }}</p>
              <p class="mt-1 break-all text-xs text-slate-500">
                {{ relationship.source }} -> {{ relationship.target }}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </ResourceState>
</template>
