import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { parseBooleanFlag } from '../scheduler/scheduler-config.service.js';

@Injectable()
export class DevEndpointsGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    if (!areDevEndpointsEnabled(this.config.get<string>('ENABLE_DEV_ENDPOINTS'))) {
      throw new NotFoundException();
    }

    return true;
  }
}

export function areDevEndpointsEnabled(raw: string | undefined): boolean {
  return parseBooleanFlag(raw, false);
}
