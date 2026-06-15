<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const mode = ref<'login' | 'register'>('login');
const email = ref('');
const password = ref('');
const name = ref('');
const error = ref<string | null>(null);

const title = computed(() => (mode.value === 'login' ? 'Sign in' : 'Create account'));
const canSubmit = computed(
  () => email.value.trim().length > 0 && password.value.length >= 8 && auth.status !== 'loading'
);

async function submit(): Promise<void> {
  if (!canSubmit.value) {
    return;
  }

  error.value = null;

  try {
    if (mode.value === 'login') {
      await auth.login({
        email: email.value.trim(),
        password: password.value
      });
    } else {
      await auth.register({
        email: email.value.trim(),
        password: password.value,
        ...(name.value.trim().length === 0 ? {} : { name: name.value.trim() })
      });
    }

    await router.replace(typeof route.query.redirect === 'string' ? route.query.redirect : '/');
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Authentication failed';
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-950">
    <form class="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-sm" @submit.prevent="submit">
      <p class="text-sm font-semibold uppercase tracking-wide text-slate-500">AI Book Illustrator</p>
      <h1 class="mt-2 text-2xl font-semibold">{{ title }}</h1>

      <div class="mt-6 space-y-4">
        <label v-if="mode === 'register'" class="block text-sm font-medium">
          Name
          <input v-model="name" class="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
        </label>
        <label class="block text-sm font-medium">
          Email
          <input v-model="email" class="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="email" autocomplete="email">
        </label>
        <label class="block text-sm font-medium">
          Password
          <input v-model="password" class="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" type="password" autocomplete="current-password">
        </label>
      </div>

      <button class="mt-6 w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" :disabled="!canSubmit">
        {{ auth.status === 'loading' ? 'Please wait...' : title }}
      </button>

      <p v-if="error || auth.error" class="mt-3 text-sm text-red-700">{{ error ?? auth.error }}</p>

      <button
        class="mt-4 text-sm font-medium text-slate-700 underline"
        type="button"
        @click="mode = mode === 'login' ? 'register' : 'login'"
      >
        {{ mode === 'login' ? 'Create a new account' : 'Use an existing account' }}
      </button>
    </form>
  </main>
</template>
