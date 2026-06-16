import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

import AnalysisProgressView from '../views/AnalysisProgressView.vue';
import CharacterDetailView from '../views/CharacterDetailView.vue';
import CharacterVisualPassportView from '../views/CharacterVisualPassportView.vue';
import CharactersListView from '../views/CharactersListView.vue';
import DashboardView from '../views/DashboardView.vue';
import GalleryView from '../views/GalleryView.vue';
import KnowledgeGraphView from '../views/KnowledgeGraphView.vue';
import LocationDetailView from '../views/LocationDetailView.vue';
import LocationsListView from '../views/LocationsListView.vue';
import ObjectDetailView from '../views/ObjectDetailView.vue';
import ObjectsListView from '../views/ObjectsListView.vue';
import ProjectWorldBibleView from '../views/ProjectWorldBibleView.vue';
import SceneGeneratorView from '../views/SceneGeneratorView.vue';
import TimelineView from '../views/TimelineView.vue';
import UploadBookView from '../views/UploadBookView.vue';
import VisualStylesView from '../views/VisualStylesView.vue';
import LoginView from '../views/LoginView.vue';
import { useAuthStore } from '../stores/auth';

export const routes: readonly RouteRecordRaw[] = [
  { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
  { path: '/', name: 'dashboard', component: DashboardView },
  { path: '/upload', name: 'upload', component: UploadBookView },
  { path: '/analysis', name: 'analysis', component: AnalysisProgressView },
  { path: '/world-bible', name: 'world-bible', component: ProjectWorldBibleView },
  { path: '/characters', name: 'characters', component: CharactersListView },
  {
    path: '/characters/:id',
    name: 'character-detail',
    component: CharacterDetailView,
    props: true
  },
  {
    path: '/characters/:id/visual-passport',
    name: 'character-passport',
    component: CharacterVisualPassportView,
    props: true
  },
  { path: '/locations', name: 'locations', component: LocationsListView },
  { path: '/locations/:id', name: 'location-detail', component: LocationDetailView, props: true },
  { path: '/objects', name: 'objects', component: ObjectsListView },
  { path: '/objects/:id', name: 'object-detail', component: ObjectDetailView, props: true },
  { path: '/timeline', name: 'timeline', component: TimelineView },
  { path: '/graph', name: 'graph', component: KnowledgeGraphView },
  { path: '/styles', name: 'styles', component: VisualStylesView },
  { path: '/scene-generator', name: 'scene-generator', component: SceneGeneratorView },
  { path: '/gallery', name: 'gallery', component: GalleryView }
];

export const router = createRouter({
  history: createWebHistory(),
  routes: [...routes]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.isAuthenticated && authTokenExists()) {
    await auth.loadCurrentUser();
  }

  if (to.meta.public === true) {
    return auth.isAuthenticated ? { name: 'dashboard' } : true;
  }

  return auth.isAuthenticated ? true : { name: 'login', query: { redirect: to.fullPath } };
});

function authTokenExists(): boolean {
  return localStorage.getItem('abi.auth.accessToken') !== null;
}
