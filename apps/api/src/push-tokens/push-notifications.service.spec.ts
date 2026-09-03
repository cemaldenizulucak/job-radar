import { ExpoPushClient } from './expo-push.client.js';
import { PushNotificationsService } from './push-notifications.service.js';
import { PushTokensService } from './push-tokens.service.js';
import type { UserPushToken } from './push-tokens.types.js';

function token(overrides: Partial<UserPushToken> = {}): UserPushToken {
  return {
    id: 'token-1',
    userId: 'user-1',
    expoPushToken: 'ExponentPushToken[aaa]',
    platform: 'android',
    isActive: true,
    ...overrides,
  };
}

describe('PushNotificationsService', () => {
  it('sends to every active token with JOB_DISCOVERY data', async () => {
    const send = vi.fn(async () => [
      { status: 'ok' as const, id: 'ticket-1' },
      { status: 'ok' as const, id: 'ticket-2' },
    ]);
    const listActiveForUser = vi.fn(async () => [
      token(),
      token({
        id: 'token-2',
        expoPushToken: 'ExponentPushToken[bbb]',
        platform: 'ios',
      }),
    ]);
    const service = new PushNotificationsService(
      { listActiveForUser, deactivate: vi.fn() } as unknown as PushTokensService,
      { send } as unknown as ExpoPushClient,
    );

    await service.sendDiscoveryPush({
      userId: 'user-1',
      title: '3 yeni ilan bulundu',
      body: '2 LinkedIn, 1 Kariyer.net',
    });

    expect(send).toHaveBeenCalledWith([
      {
        to: 'ExponentPushToken[aaa]',
        title: '3 yeni ilan bulundu',
        body: '2 LinkedIn, 1 Kariyer.net',
        sound: 'default',
        data: {
          type: 'JOB_DISCOVERY',
          route: '/jobs',
          discoveryRunId: null,
          savedSearchId: null,
          newJobCount: null,
        },
      },
      {
        to: 'ExponentPushToken[bbb]',
        title: '3 yeni ilan bulundu',
        body: '2 LinkedIn, 1 Kariyer.net',
        sound: 'default',
        data: {
          type: 'JOB_DISCOVERY',
          route: '/jobs',
          discoveryRunId: null,
          savedSearchId: null,
          newJobCount: null,
        },
      },
    ]);
  });

  it('does not throw when Expo is unavailable', async () => {
    const service = new PushNotificationsService(
      {
        listActiveForUser: async () => [token()],
        deactivate: vi.fn(),
      } as unknown as PushTokensService,
      {
        send: async () => {
          throw new Error('network down');
        },
      } as unknown as ExpoPushClient,
    );

    await expect(
      service.sendDiscoveryPush({
        userId: 'user-1',
        title: '1 yeni ilan bulundu',
        body: '1 LinkedIn',
      }),
    ).resolves.toBeUndefined();
  });

  it('deactivates DeviceNotRegistered tokens', async () => {
    const deactivate = vi.fn(async () => undefined);
    const service = new PushNotificationsService(
      {
        listActiveForUser: async () => [token()],
        deactivate,
      } as unknown as PushTokensService,
      {
        send: async () => [
          {
            status: 'error',
            message: 'not registered',
            errorCode: 'DeviceNotRegistered',
          },
        ],
      } as unknown as ExpoPushClient,
    );

    await service.sendDiscoveryPush({
      userId: 'user-1',
      title: '1 yeni ilan bulundu',
      body: '1 LinkedIn',
    });

    expect(deactivate).toHaveBeenCalledWith('ExponentPushToken[aaa]');
  });

  it('skips the Expo API when the user has no active tokens', async () => {
    const send = vi.fn();
    const service = new PushNotificationsService(
      {
        listActiveForUser: async () => [],
        deactivate: vi.fn(),
      } as unknown as PushTokensService,
      { send } as unknown as ExpoPushClient,
    );

    await service.sendDiscoveryPush({
      userId: 'user-1',
      title: '1 yeni ilan bulundu',
      body: '1 LinkedIn',
    });

    expect(send).not.toHaveBeenCalled();
  });
});
