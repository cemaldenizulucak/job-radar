import { describe, expect, it } from 'vitest';

import {
  isJobDiscoveryNotification,
  jobDiscoveryNotificationRoute,
} from './push-notification-data';

describe('job discovery notification tap data', () => {
  it('opens /jobs for JOB_DISCOVERY payloads', () => {
    const data = { type: 'JOB_DISCOVERY', route: '/jobs' };

    expect(isJobDiscoveryNotification(data)).toBe(true);
    expect(jobDiscoveryNotificationRoute(data)).toBe('/jobs');
  });

  it('opens /jobs when JOB_DISCOVERY omits route', () => {
    expect(jobDiscoveryNotificationRoute({ type: 'JOB_DISCOVERY' })).toBe(
      '/jobs',
    );
  });

  it('ignores unrelated notification data', () => {
    expect(isJobDiscoveryNotification({ type: 'other', route: '/jobs' })).toBe(
      false,
    );
    expect(jobDiscoveryNotificationRoute({ type: 'other', route: '/jobs' })).toBe(
      null,
    );
  });
});
