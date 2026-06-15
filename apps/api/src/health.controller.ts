import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from './auth/public.decorator.js';

@ApiTags('health')
@Controller()
@Public()
export class HealthController {
  @Get('healthz')
  @ApiOkResponse({ description: 'API health status.' })
  health(): { readonly status: 'ok' } {
    return { status: 'ok' };
  }
}
