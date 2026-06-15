import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_ROUTE_KEY = 'abi:is-public-route';

export function Public() {
  return SetMetadata(IS_PUBLIC_ROUTE_KEY, true);
}
