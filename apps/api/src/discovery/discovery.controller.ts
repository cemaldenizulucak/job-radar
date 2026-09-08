import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { Public } from '../auth/public.decorator.js';
import { DevEndpointsGuard } from '../common/dev-endpoints.guard.js';
import { DiscoveryService } from './discovery.service.js';
import type {
  DiscoveryRunSummary,
  MatchReevaluationReport,
} from './discovery.types.js';

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

  /**
   * Re-evaluates stored matches without fetching job sources.
   * Defaults to dry-run. Set `{ "dryRun": false }` to apply.
   */
  @Public()
  @UseGuards(DevEndpointsGuard)
  @Post('rematch-matches')
  rematchMatches(
    @Body() body?: { dryRun?: boolean },
  ): Promise<MatchReevaluationReport> {
    return this.discoveryService.rematchStoredMatches({
      dryRun: body?.dryRun !== false,
    });
  }
}
