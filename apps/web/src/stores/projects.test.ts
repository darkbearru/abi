import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useProjectsStore } from './projects';

const projectsClientMock = vi.hoisted(() => ({
  list: vi.fn()
}));

vi.mock('../api', () => ({
  projectsClient: projectsClientMock
}));

describe('projects store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('loads projects and selects the first project by default', async () => {
    projectsClientMock.list.mockResolvedValue([
      { id: 'project-1', name: 'Cycle One', seriesTitle: 'North Saga' },
      { id: 'project-2', name: 'Standalone' }
    ]);

    const store = useProjectsStore();
    await store.loadProjects();

    expect(store.status).toBe('success');
    expect(store.projects).toHaveLength(2);
    expect(store.activeProjectId).toBe('project-1');
    expect(localStorage.getItem('abi.activeProjectId')).toBe('project-1');
  });

  it('stores API errors', async () => {
    projectsClientMock.list.mockRejectedValue(new Error('API unavailable'));

    const store = useProjectsStore();
    await store.loadProjects();

    expect(store.status).toBe('error');
    expect(store.error).toBe('API unavailable');
  });
});
