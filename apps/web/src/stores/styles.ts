import type { AsyncStatus, VisualStyle } from '@abi/shared';
import { defineStore } from 'pinia';

import { stylesClient } from '../api';

interface StylesState {
  status: AsyncStatus;
  error: string | null;
  styles: VisualStyle[];
}

export const useStylesStore = defineStore('styles', {
  state: (): StylesState => ({
    status: 'idle',
    error: null,
    styles: []
  }),
  actions: {
    async loadStyles(): Promise<void> {
      this.status = 'loading';
      this.error = null;

      try {
        this.styles = [...(await stylesClient.list())];
        this.status = 'success';
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Unable to load styles';
        this.status = 'error';
      }
    }
  }
});
