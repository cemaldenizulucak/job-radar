import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { ProfilesService } from './profiles.service.js';

describe('ProfilesService', () => {
  it('maps display_name from public.profiles', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'user-1',
        display_name: 'Ada Lovelace',
        email: 'ada@example.com',
        notifications_enabled: true,
        timezone: 'Europe/Istanbul',
      },
      error: null,
    }));
    const service = new ProfilesService({
      getClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle }),
          }),
        }),
      }),
    } as unknown as SupabaseService);

    await expect(service.getByUserId('user-1')).resolves.toEqual({
      userId: 'user-1',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      notificationsEnabled: true,
      timezone: 'Europe/Istanbul',
    });
  });

  it('upserts notifications_enabled', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'user-1',
        display_name: 'Ada',
        notifications_enabled: false,
      },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const upsert = vi.fn(() => ({ select }));
    const service = new ProfilesService({
      getClient: () => ({ from: () => ({ upsert }) }),
    } as unknown as SupabaseService);

    const result = await service.updateNotificationsEnabled('user-1', false);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        notifications_enabled: false,
      }),
      { onConflict: 'id' },
    );
    expect(result.notificationsEnabled).toBe(false);
  });
});
