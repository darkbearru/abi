import type { VisualStyle } from '@abi/shared';

import { apiTransport } from './transport';

export const stylesClient = {
  list: () => apiTransport.request<readonly VisualStyle[]>('/styles')
};
