import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { PushTokensService } from './push-tokens.service.js';

describe('PushTokensService', () => {
  it('upserts a token as active', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'token-1',
        user_id: 'user-1',
        expo_push_token: 'ExponentPushToken[aaa]',
        platform: 'android',
        is_active: true,
      },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const upsert = vi.fn(() => ({ select }));
    const service = new PushTokensService({
      getClient: () => ({ from: () => ({ upsert }) }),
    } as unknown as SupabaseService);

    const result = await service.register({
      userId: 'user-1',
      expoPushToken: 'ExponentPushToken[aaa]',
      platform: 'android',
    });

    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        expo_push_token: 'ExponentPushToken[aaa]',
        platform: 'android',
        is_active: true,
        updated_at: expect.any(String),
      },
      { onConflict: 'user_id,expo_push_token' },
    );
    expect(result).toMatchObject({
      id: 'token-1',
      userId: 'user-1',
      expoPushToken: 'ExponentPushToken[aaa]',
      platform: 'android',
      isActive: true,
    });
  });

  it('deactivates a token on unregister', async () => {
    const eqToken = vi.fn(async () => ({ error: null }));
    const eqUser = vi.fn(() => ({ eq: eqToken }));
    const update = vi.fn(() => ({ eq: eqUser }));
    const service = new PushTokensService({
      getClient: () => ({ from: () => ({ update }) }),
    } as unknown as SupabaseService);

    await service.unregister({
      userId: 'user-1',
      expoPushToken: 'ExponentPushToken[aaa]',
    });

    expect(update).toHaveBeenCalledWith({
      is_active: false,
      updated_at: expect.any(String),
    });
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eqToken).toHaveBeenCalledWith(
      'expo_push_token',
      'ExponentPushToken[aaa]',
    );
  });
});
