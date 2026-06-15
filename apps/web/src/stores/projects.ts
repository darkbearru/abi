import type { AsyncStatus, ProjectSummary } from '@abi/shared';
import { defineStore } from 'pinia';

import { projectsClient } from '../api';

interface ProjectsState {
  status: AsyncStatus;
  error: string | null;
  activeProjectId: string | null;
  projects: ProjectSummary[];
}

export const useProjectsStore = defineStore('projects', {
  state: (): ProjectsState => ({
    status: 'idle',
    error: null,
    activeProjectId: localStorage.getItem('abi.activeProjectId'),
    projects: []
  }),
  getters: {
    activeProject(state): ProjectSummary | null {
      return state.projects.find((project) => project.id === state.activeProjectId) ?? null;
    }
  },
  actions: {
    setActiveProject(projectId: string): void {
      this.activeProjectId = projectId;
      localStorage.setItem('abi.activeProjectId', projectId);
    },
    clearProjects(): void {
      this.activeProjectId = null;
      this.projects = [];
      this.status = 'idle';
      this.error = null;
      localStorage.removeItem('abi.activeProjectId');
    },
    async loadProjects(): Promise<void> {
      this.status = 'loading';
      this.error = null;

      try {
        this.projects = [...(await projectsClient.list())];

        if (!this.activeProjectId && this.projects[0]) {
          this.setActiveProject(this.projects[0].id);
        }

        this.status = 'success';
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unable to load projects';
        this.status = 'error';
      }
    }
  }
});
