import { useEffect, useState } from 'react';

import {
  getProfile,
  type ProfileRecord,
} from '@/features/profile/services/profile.service';

export function useProfileLocation(): {
  city: string | null;
  country: string | null;
} | null {
  const [profile, setProfile] = useState<Pick<
    ProfileRecord,
    'city' | 'country'
  > | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getProfile()
      .then((next) => {
        if (!cancelled) {
          setProfile({ city: next.city, country: next.country });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfile(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return profile;
}
