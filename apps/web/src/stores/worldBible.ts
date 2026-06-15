import type {
  AsyncStatus,
  Character,
  Location,
  ProjectGraph,
  TimelineEvent
} from '@abi/shared';
import { defineStore } from 'pinia';

import { charactersClient, locationsClient, projectsClient, timelineClient } from '../api';

interface WorldBibleState {
  status: AsyncStatus;
  error: string | null;
  characters: Character[];
  locations: Location[];
  timeline: TimelineEvent[];
  graph: ProjectGraph | null;
}

export const useWorldBibleStore = defineStore('worldBible', {
  state: (): WorldBibleState => ({
    status: 'idle',
    error: null,
    characters: [],
    locations: [],
    timeline: [],
    graph: null
  }),
  actions: {
    async loadProjectWorld(projectId: string): Promise<void> {
      this.status = 'loading';
      this.error = null;

      try {
        const [characters, locations, timeline] = await Promise.all([
          charactersClient.list(projectId),
          locationsClient.list(projectId),
          timelineClient.list(projectId)
        ]);

        this.characters = [...characters];
        this.locations = [...locations];
        this.timeline = [...timeline];
        this.status = 'success';
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unable to load world bible';
        this.status = 'error';
      }
    },
    async loadGraph(projectId: string): Promise<void> {
      this.status = 'loading';
      this.error = null;

      try {
        this.graph = await projectsClient.graph(projectId);
        this.status = 'success';
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unable to load graph';
        this.status = 'error';
      }
    }
  }
});
