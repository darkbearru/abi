import { SetMetadata } from '@nestjs/common';

export const ACCESS_CONTROL_RESOURCE_KEY = 'abi:access-control-resource';

export type AccessControlledResource =
  | 'project'
  | 'job'
  | 'asset'
  | 'character'
  | 'characterVersion'
  | 'location'
  | 'locationVersion';

export function RequireProjectAccess(resource: AccessControlledResource) {
  return SetMetadata(ACCESS_CONTROL_RESOURCE_KEY, resource);
}
