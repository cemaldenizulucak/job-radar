import { type Href, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { ScreenHeader } from '@/components/screen-header';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { useJobsFilterStore } from '@/features/jobs/stores/jobs-filter.store';
import { userErrorMessage } from '@/lib/api-error';

import { SavedSearchForm } from '../components/saved-search-form';
import { SearchBackButton } from '../components/search-back-button';
import { searchesCopy } from '../copy';
import { createSavedSearch } from '../services/saved-search.service';
import type { SavedSearchWriteInput } from '../types/search.types';
import {
  createSubmitLock,
  isDiscoveryPending,
  isDiscoveryWarning,
  PARTIAL_DISCOVERY_MESSAGE,
} from '../utils/search-write';

export function CreateSearchScreen() {
  const router = useRouter();
  const setSavedSearchId = useJobsFilterStore((state) => state.setSavedSearchId);
  const bumpSearchCatalog = useJobsFilterStore((state) => state.bumpSearchCatalog);
  const beginPendingDiscovery = useJobsFilterStore(
    (state) => state.beginPendingDiscovery,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const submitLock = useRef(createSubmitLock()).current;

  const onSubmit = async (input: SavedSearchWriteInput) => {
    if (!submitLock.tryAcquire()) {
      return;
    }

    setFormError(null);

    try {
      const result = await createSavedSearch(input);
      setSavedSearchId(result.search.id);
      bumpSearchCatalog();
      if (isDiscoveryPending(result.discovery.status)) {
        beginPendingDiscovery(result.search.id);
      }
      if (isDiscoveryWarning(result.discovery.status)) {
        Alert.alert(searchesCopy.savedAlertTitle, PARTIAL_DISCOVERY_MESSAGE);
      }
      router.replace('/jobs' as Href);
    } catch (error) {
      setFormError(userErrorMessage(error, searchesCopy.createError));
    } finally {
      submitLock.release();
    }
  };

  return (
    <ScreenScaffold>
      <SearchBackButton onPress={() => router.back()} />
      <ScreenHeader
        title={searchesCopy.createTitle}
        subtitle={searchesCopy.createSubtitle}
      />
      <SavedSearchForm
        submitLabel={searchesCopy.saveSearch}
        submittingLabel={searchesCopy.saveSearch}
        formError={formError}
        onSubmit={onSubmit}
      />
    </ScreenScaffold>
  );
}
