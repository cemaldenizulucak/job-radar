import {
  hasProfileCountry,
  type ProfileLocation,
} from '../../../lib/search-location';

import { profileCopy } from '../copy';

export const LOCATION_SETUP_JOBS_HREF = '/jobs';

export function locationSetupUserMessage(): string {
  return `${profileCopy.locationSaveError} ${profileCopy.locationSaveRetry}`;
}

export function shouldEnterAppAfterLocationSave(
  profile: ProfileLocation,
): boolean {
  return hasProfileCountry(profile);
}
