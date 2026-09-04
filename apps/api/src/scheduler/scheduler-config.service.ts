import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  DEFAULT_DISCOVERY_INTERVAL_HOURS,
  readPositiveIntEnv,
} from '../discovery/discovery-window.js';
import { DEFAULT_SCHEDULER_TIMEZONE } from './scheduler.types.js';

export const DEFAULT_DISCOVERY_CRON_NAME = 'discovery-interval';

@Injectable()
export class SchedulerConfigService {
  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return isDiscoverySchedulerEnabled(
      this.configService.get<string>('DISCOVERY_SCHEDULER_ENABLED'),
      this.configService.get<string>('SCHEDULER_ENABLED'),
    );
  }

  getTimezone(): string {
    const configured = this.configService.get<string>('SCHEDULER_TIMEZONE');
    const trimmed = configured?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_SCHEDULER_TIMEZONE;
  }

  getIntervalHours(): number {
    return Math.min(
      24,
      readPositiveIntEnv(
        this.configService.get<string>('DISCOVERY_INTERVAL_HOURS'),
        DEFAULT_DISCOVERY_INTERVAL_HOURS,
      ),
    );
  }

  getCron(): string {
    return toIntervalCron(this.getIntervalHours());
  }
}

export function toIntervalCron(intervalHours: number): string {
  const hours = Math.min(24, Math.max(1, Math.floor(intervalHours)));
  return hours === 1 ? '0 * * * *' : `0 */${hours} * * *`;
}

export function isDiscoverySchedulerEnabled(
  discoveryFlag: string | undefined,
  legacyFlag: string | undefined,
): boolean {
  if (discoveryFlag !== undefined && discoveryFlag.trim().length > 0) {
    return parseBooleanFlag(discoveryFlag, false);
  }

  return parseBooleanFlag(legacyFlag, false);
}

export function parseBooleanFlag(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined || value.trim().length === 0) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
}
