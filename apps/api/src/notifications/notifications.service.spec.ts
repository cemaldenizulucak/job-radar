import { NotFoundException } from '@nestjs/common';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { PushNotificationsService } from '../push-tokens/push-notifications.service.js';
import { NotificationsService } from './notifications.service.js';

describe('NotificationsService', () => {
  it('does not insert a second digest for the same discovery run and user', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'n-1',
        user_id: 'user-1',
        title: '1 yeni ilan bulundu',
        message: '1 LinkedIn',
        type: 'JOB_DISCOVERY',
        is_read: false,
        created_at: '2026-09-01T08:00:00.000Z',
      },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const insert = vi.fn(() => ({ select }));
    const service = new NotificationsService({
      getClient: () => ({ from: () => ({ insert }) }),
    } as unknown as SupabaseService);

    const input = {
      runId: 'run-1',
      jobs: [{ id: 'job-li', sourceId: 'linkedin' as const }],
      searchOwners: new Map([['search-a', 'user-1']]),
      matches: [{ jobId: 'job-li', savedSearchId: 'search-a' }],
    };

    await expect(
      service.createForNewMatches({ ...input, matches: [] }),
    ).resolves.toBe(0);
    await expect(service.createForNewMatches(input)).resolves.toBe(1);
    await expect(service.createForNewMatches(input)).resolves.toBe(0);
    expect(insert).toHaveBeenCalledOnce();
  });

  it('sends a push after creating a discovery digest', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'n-1',
        user_id: 'user-1',
        title: '1 yeni ilan bulundu',
        message: '1 LinkedIn',
        type: 'JOB_DISCOVERY',
        is_read: false,
        created_at: '2026-09-01T08:00:00.000Z',
      },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const insert = vi.fn(() => ({ select }));
    const sendDiscoveryPush = vi.fn(async () => undefined);
    const service = new NotificationsService(
      {
        getClient: () => ({ from: () => ({ insert }) }),
      } as unknown as SupabaseService,
      { sendDiscoveryPush } as unknown as PushNotificationsService,
    );

    await expect(
      service.createForNewMatches({
        runId: 'run-push',
        jobs: [{ id: 'job-li', sourceId: 'linkedin' }],
        searchOwners: new Map([['search-a', 'user-1']]),
        matches: [{ jobId: 'job-li', savedSearchId: 'search-a' }],
      }),
    ).resolves.toBe(1);

    expect(sendDiscoveryPush).toHaveBeenCalledWith({
      userId: 'user-1',
      title: '1 yeni ilan bulundu',
      body: '1 LinkedIn',
      discoveryRunId: 'run-push',
      savedSearchId: 'search-a',
      newJobCount: 1,
    });
  });

  it('still creates the inbox row if push sending throws', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'n-1',
        user_id: 'user-1',
        title: '1 yeni ilan bulundu',
        message: '1 LinkedIn',
        type: 'JOB_DISCOVERY',
        is_read: false,
        created_at: '2026-09-01T08:00:00.000Z',
      },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const insert = vi.fn(() => ({ select }));
    const sendDiscoveryPush = vi.fn(async () => {
      throw new Error('expo unavailable');
    });
    const service = new NotificationsService(
      {
        getClient: () => ({ from: () => ({ insert }) }),
      } as unknown as SupabaseService,
      { sendDiscoveryPush } as unknown as PushNotificationsService,
    );

    await expect(
      service.createForNewMatches({
        runId: 'run-push-fail',
        jobs: [{ id: 'job-li', sourceId: 'linkedin' }],
        searchOwners: new Map([['search-a', 'user-1']]),
        matches: [{ jobId: 'job-li', savedSearchId: 'search-a' }],
      }),
    ).resolves.toBe(1);
    expect(insert).toHaveBeenCalledOnce();
  });

  it('creates a development test notification with the expected digest copy', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'n-test',
        user_id: 'user-1',
        title: '3 yeni ilan bulundu',
        message: '2 LinkedIn, 1 Kariyer.net',
        type: 'JOB_DISCOVERY',
        is_read: false,
        created_at: '2026-09-01T08:00:00.000Z',
      },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const insert = vi.fn(() => ({ select }));
    const service = new NotificationsService({
      getClient: () => ({ from: () => ({ insert }) }),
    } as unknown as SupabaseService);

    const result = await service.createTestNotification('user-1');

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        title: '3 yeni ilan bulundu',
        message: '2 LinkedIn, 1 Kariyer.net',
        type: 'JOB_DISCOVERY',
        is_read: false,
        data: expect.objectContaining({
          discoveryRunId: 'test',
          savedSearchId: null,
          newJobCount: 3,
        }),
      }),
    );
    expect(insert.mock.calls[0]?.[0]).not.toHaveProperty('body');
    expect(insert.mock.calls[0]?.[0]).not.toHaveProperty('read_at');
    expect(result).toMatchObject({
      id: 'n-test',
      userId: 'user-1',
      title: '3 yeni ilan bulundu',
      message: '2 LinkedIn, 1 Kariyer.net',
      type: 'JOB_DISCOVERY',
      isRead: false,
    });
  });

  it('returns newest-first rows for a user', async () => {
    const order = vi.fn(async () => ({
      data: [
        {
          id: 'n-2',
          user_id: 'user-1',
          title: '2 yeni ilan bulundu',
          message: '2 LinkedIn',
          type: 'JOB_DISCOVERY',
          is_read: false,
          created_at: '2026-09-01T19:00:00.000Z',
        },
        {
          id: 'n-1',
          user_id: 'user-1',
          title: '1 yeni ilan bulundu',
          message: '1 Kariyer.net',
          type: 'JOB_DISCOVERY',
          is_read: true,
          created_at: '2026-09-01T08:00:00.000Z',
        },
      ],
      error: null,
    }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const service = new NotificationsService({
      getClient: () => ({ from: () => ({ select }) }),
    } as unknown as SupabaseService);

    const items = await service.listForUser('user-1');

    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(items.map((item) => item.id)).toEqual(['n-2', 'n-1']);
    expect(items[0]?.isRead).toBe(false);
  });

  it('marks a notification as read for the owning user', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'n-1',
        user_id: 'user-1',
        title: '1 yeni ilan bulundu',
        message: '1 LinkedIn',
        type: 'JOB_DISCOVERY',
        is_read: true,
        created_at: '2026-09-01T08:00:00.000Z',
      },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const eqUser = vi.fn(() => ({ select }));
    const eqId = vi.fn(() => ({ eq: eqUser }));
    const update = vi.fn(() => ({ eq: eqId }));
    const service = new NotificationsService({
      getClient: () => ({ from: () => ({ update }) }),
    } as unknown as SupabaseService);

    const result = await service.markRead('n-1', 'user-1');

    expect(update).toHaveBeenCalledWith({ is_read: true });
    expect(update.mock.calls[0]?.[0]).not.toHaveProperty('read_at');
    expect(eqId).toHaveBeenCalledWith('id', 'n-1');
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(result.isRead).toBe(true);
  });

  it('returns 404 when the notification is missing for that user', async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const service = new NotificationsService({
      getClient: () => ({
        from: () => ({
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({ maybeSingle }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseService);

    await expect(service.markRead('missing', 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
