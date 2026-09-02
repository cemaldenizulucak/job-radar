import { Controller, Post, UseGuards } from '@nestjs/common';

import { Public } from '../auth/public.decorator.js';
import { DevEndpointsGuard } from '../common/dev-endpoints.guard.js';
import { DiscoveryService } from './discovery.service.js';
import type { DiscoveryRunSummary } from './discovery.types.js';

@Controller('v1/discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  /**
   * TEMPORARY development endpoint.
   * Disabled unless ENABLE_DEV_ENDPOINTS=true. Do not call from the mobile app.
   */
  @Public()
  @UseGuards(DevEndpointsGuard)
  @Post('run')
  run(): Promise<DiscoveryRunSummary> {
    return this.discoveryService.run();
  }
}
