import { describe, expect, it } from 'vitest';

import {
  isJobDiscoveryNotification,
  jobDiscoveryNotificationRoute,
  jobDiscoverySavedSearchId,
} from './push-notification-data';
import {
  IOS_PUSH_PERMISSIONS,
  nativePushPlatform,
  shouldRegisterPushOnPlatform,
} from './push-platform';

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

  it('reads the saved search filter when present', () => {
    expect(
      jobDiscoverySavedSearchId({
        type: 'JOB_DISCOVERY',
        route: '/jobs',
        savedSearchId: 'search-gida',
        newJobCount: 12,
      }),
    ).toBe('search-gida');
    expect(jobDiscoverySavedSearchId({ type: 'JOB_DISCOVERY' })).toBe(null);
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

describe('push platform registration', () => {
  it('registers native iOS and Android, not web', () => {
    expect(shouldRegisterPushOnPlatform('ios')).toBe(true);
    expect(shouldRegisterPushOnPlatform('android')).toBe(true);
    expect(shouldRegisterPushOnPlatform('web')).toBe(false);
  });

  it('maps native platforms without assuming Android', () => {
    expect(nativePushPlatform('ios')).toBe('ios');
    expect(nativePushPlatform('android')).toBe('android');
  });

  it('requests iOS alert, badge, and sound permissions', () => {
    expect(IOS_PUSH_PERMISSIONS).toEqual({
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    });
  });
});
