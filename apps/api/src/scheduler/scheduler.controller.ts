import { Controller, Post, UseGuards } from '@nestjs/common';

import { Public } from '../auth/public.decorator.js';
import { DevEndpointsGuard } from '../common/dev-endpoints.guard.js';
import { SchedulerService } from './scheduler.service.js';
import type { SchedulerRunResult } from './scheduler.types.js';

@Controller('v1/scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  /**
   * TEMPORARY development endpoint.
   * Disabled unless ENABLE_DEV_ENDPOINTS=true. Do not call from the mobile app.
   */
  @Public()
  @UseGuards(DevEndpointsGuard)
  @Post('run')
  run(): Promise<SchedulerRunResult> {
    return this.schedulerService.runManual();
  }
}
