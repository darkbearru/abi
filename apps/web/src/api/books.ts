import type { BookUploadResponse } from '@abi/shared';

import { apiTransport } from './transport';

export const booksClient = {
  upload: (form: FormData) =>
    apiTransport.request<BookUploadResponse>('/books/upload', {
      method: 'POST',
      body: form
    })
};
