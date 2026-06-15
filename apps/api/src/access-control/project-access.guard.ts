import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import {
  ACCESS_CONTROL_RESOURCE_KEY,
  type AccessControlledResource
} from './access-control.decorator.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { ProjectAccessService } from './project-access.service.js';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: ProjectAccessService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<AccessControlledResource | undefined>(
      ACCESS_CONTROL_RESOURCE_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (resource === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest & Request>();
    const id = request.params.id;

    if (typeof id !== 'string' || id.length === 0) {
      return false;
    }

    const userId = request.user?.id;

    switch (resource) {
      case 'project':
        await this.access.assertCanAccessProject(id, userId);
        break;
      case 'job':
        await this.access.assertCanAccessJob(id, userId);
        break;
      case 'asset':
        await this.access.assertCanAccessAsset(id, userId);
        break;
      case 'character':
        await this.access.assertCanAccessCharacter(id, userId);
        break;
      case 'characterVersion':
        await this.access.assertCanAccessCharacterVersion(id, userId);
        break;
      case 'location':
        await this.access.assertCanAccessLocation(id, userId);
        break;
      case 'locationVersion':
        await this.access.assertCanAccessLocationVersion(id, userId);
        break;
    }

    return true;
  }
}
