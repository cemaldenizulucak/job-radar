import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { Public } from '../auth/public.decorator.js';
import { DevEndpointsGuard } from '../common/dev-endpoints.guard.js';
import { DiscoveryService } from './discovery.service.js';
import type {
  DiscoveryRunSummary,
  ListingDiagnosis,
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

  /**
   * Explains why one listing is missing from a saved search.
   * Catalog lookup only: does not fetch the URL or follow redirects.
   * User URLs are allowlisted to Kariyer.net / LinkedIn public hosts.
   * Same access gate as other discovery helpers: @Public() skips JWT,
   * DevEndpointsGuard returns 404 unless ENABLE_DEV_ENDPOINTS=true.
   */
  @Public()
  @UseGuards(DevEndpointsGuard)
  @Post('diagnose-listing')
  diagnoseListing(
    @Body()
    body: {
      savedSearchId: string;
      sourceId?: 'linkedin' | 'kariyer_net';
      sourceJobId?: string;
      url?: string;
    },
  ): Promise<ListingDiagnosis | null> {
    return this.discoveryService.diagnoseListing(body);
  }
}
