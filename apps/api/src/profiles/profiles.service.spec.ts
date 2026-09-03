import { InternalServerErrorException, Logger } from '@nestjs/common';

import { SupabaseService } from '../infrastructure/supabase/supabase.service.js';
import { ProfilesService } from './profiles.service.js';

function selectClient(maybeSingle: ReturnType<typeof vi.fn>) {
  return {
    getClient: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle }),
        }),
      }),
    }),
  } as unknown as SupabaseService;
}

function writeClient(options: {
  existing: Record<string, unknown> | null;
  saved: Record<string, unknown>;
  findError?: { message: string; code?: string };
  writeError?: { message: string; code?: string };
}) {
  const update = vi.fn(() => ({
    eq: () => ({
      select: () => ({
        maybeSingle: async () =>
          options.writeError
            ? { data: null, error: options.writeError }
            : { data: options.saved, error: null },
      }),
    }),
  }));
  const upsert = vi.fn(() => ({
    select: () => ({
      maybeSingle: async () =>
        options.writeError
          ? { data: null, error: options.writeError }
          : { data: options.saved, error: null },
    }),
  }));

  return {
    update,
    upsert,
    service: new ProfilesService({
      getClient: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () =>
                options.findError
                  ? { data: null, error: options.findError }
                  : { data: options.existing, error: null },
            }),
          }),
          update,
          upsert,
        }),
      }),
    } as unknown as SupabaseService),
  };
}

describe('ProfilesService', () => {
  it('maps display_name and location from public.profiles', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'user-1',
        display_name: 'Ada Lovelace',
        email: 'ada@example.com',
        notifications_enabled: true,
        timezone: 'Europe/Istanbul',
        country: 'Turkey',
        city: 'Izmir',
      },
      error: null,
    }));
    const service = new ProfilesService(selectClient(maybeSingle));

    await expect(service.getByUserId('user-1')).resolves.toEqual({
      userId: 'user-1',
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      notificationsEnabled: true,
      timezone: 'Europe/Istanbul',
      country: 'Turkey',
      city: 'Izmir',
    });
  });

  it('returns empty location when the profile row has no country or city', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'user-1',
        display_name: 'Ada',
      },
      error: null,
    }));
    const service = new ProfilesService(selectClient(maybeSingle));

    await expect(service.getByUserId('user-1')).resolves.toMatchObject({
      country: null,
      city: null,
    });
  });

  it('updates an existing profile country and city', async () => {
    const saved = {
      id: 'user-1',
      country: 'Türkiye',
      city: 'İzmir',
    };
    const { service, update, upsert } = writeClient({
      existing: { id: 'user-1' },
      saved,
    });

    const result = await service.update('user-1', {
      country: 'Türkiye',
      city: 'İzmir',
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        country: 'Türkiye',
        city: 'İzmir',
      }),
    );
    expect(upsert).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      country: 'Türkiye',
      city: 'İzmir',
    });
  });

  it('upserts a missing profile row', async () => {
    const saved = {
      id: 'user-1',
      country: 'Türkiye',
      city: 'İzmir',
    };
    const { service, update, upsert } = writeClient({
      existing: null,
      saved,
    });

    const result = await service.update('user-1', {
      country: 'Türkiye',
      city: 'İzmir',
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        country: 'Türkiye',
        city: 'İzmir',
      }),
      { onConflict: 'id' },
    );
    expect(update).not.toHaveBeenCalled();
    expect(result.userId).toBe('user-1');
  });

  it('saves a nullable city', async () => {
    const { service, upsert } = writeClient({
      existing: null,
      saved: { id: 'user-1', country: 'Türkiye', city: null },
    });

    const result = await service.update('user-1', {
      country: 'Türkiye',
      city: null,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        country: 'Türkiye',
        city: null,
      }),
      { onConflict: 'id' },
    );
    expect(result.city).toBeNull();
  });

  it('logs the endpoint and database error without succeeding', async () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { service } = writeClient({
      existing: null,
      saved: {},
      writeError: {
        code: 'PGRST204',
        message: "Could not find the 'country' column of 'profiles' in the schema cache",
      },
    });

    await expect(
      service.update('user-1', { country: 'Türkiye', city: 'İzmir' }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'PATCH /v1/profiles',
        code: 'PGRST204',
        message: "Could not find the 'country' column of 'profiles' in the schema cache",
      }),
    );
    errorSpy.mockRestore();
  });
});
