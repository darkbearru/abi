import { onMounted, watch } from 'vue';

import { useProjectsStore } from '../stores/projects';

export function useActiveProjectEffect(
  effect: (projectId: string) => Promise<void> | void
): void {
  const projects = useProjectsStore();

  async function runForActiveProject(): Promise<void> {
    if (projects.status === 'idle') {
      await projects.loadProjects();
    }

    if (projects.activeProjectId) {
      await effect(projects.activeProjectId);
    }
  }

  onMounted(() => {
    void runForActiveProject();
  });

  watch(
    () => projects.activeProjectId,
    (projectId, previousProjectId) => {
      if (projectId && projectId !== previousProjectId) {
        void effect(projectId);
      }
    }
  );
}
