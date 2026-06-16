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
    async updateVisualStyle(projectId: string, visualStyleId: string | null): Promise<void> {
      const updatedProject = await projectsClient.updateSettings(projectId, { visualStyleId });

      this.projects = this.projects.map((project) =>
        project.id === updatedProject.id ? updatedProject : project
      );
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

        const activeProjectExists =
          this.activeProjectId !== null &&
          this.projects.some((project) => project.id === this.activeProjectId);

        if (!activeProjectExists && this.projects[0]) {
          this.setActiveProject(this.projects[0].id);
        }

        if (this.projects.length === 0) {
          this.activeProjectId = null;
          localStorage.removeItem('abi.activeProjectId');
        }

        this.status = 'success';
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unable to load projects';
        this.status = 'error';
      }
    }
  }
});
