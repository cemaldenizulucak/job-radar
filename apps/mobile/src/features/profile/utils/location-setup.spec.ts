import { describe, expect, it } from 'vitest';

import {
  LOCATION_SETUP_JOBS_HREF,
  locationSetupUserMessage,
  shouldEnterAppAfterLocationSave,
} from './location-setup';

describe('location setup', () => {
  it('redirects to /jobs after a successful save', () => {
    expect(LOCATION_SETUP_JOBS_HREF).toBe('/jobs');
    expect(
      shouldEnterAppAfterLocationSave({
        country: 'Türkiye',
        city: 'İzmir',
      }),
    ).toBe(true);
  });

  it('keeps a Turkish user-facing save error', () => {
    expect(locationSetupUserMessage()).toContain('Konum kaydedilemedi.');
    expect(locationSetupUserMessage()).toContain('Tekrar deneyin.');
  });
});
