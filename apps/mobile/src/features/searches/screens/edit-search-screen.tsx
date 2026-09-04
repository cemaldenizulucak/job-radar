import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { useJobsFilterStore } from '@/features/jobs/stores/jobs-filter.store';
import { userErrorMessage } from '@/lib/api-error';

import { SavedSearchForm } from '../components/saved-search-form';
import { SearchBackButton } from '../components/search-back-button';
import { searchesCopy } from '../copy';
import { useSavedSearch } from '../hooks/useSavedSearches';
import { updateSavedSearch } from '../services/saved-search.service';
import type { SavedSearchWriteInput } from '../types/search.types';
import {
  createSubmitLock,
  isDiscoveryPending,
  isDiscoveryWarning,
  PARTIAL_DISCOVERY_MESSAGE,
} from '../utils/search-write';

export function EditSearchScreen() {
  const router = useRouter();
  const setSavedSearchId = useJobsFilterStore((state) => state.setSavedSearchId);
  const bumpSearchCatalog = useJobsFilterStore((state) => state.bumpSearchCatalog);
  const beginPendingDiscovery = useJobsFilterStore(
    (state) => state.beginPendingDiscovery,
  );
  const { id } = useLocalSearchParams<{ id: string }>();
  const searchId = Array.isArray(id) ? id[0] : id;
  const { search, isLoading, error } = useSavedSearch(searchId);
  const [formError, setFormError] = useState<string | null>(null);
  const submitLock = useRef(createSubmitLock()).current;

  const onSubmit = async (input: SavedSearchWriteInput) => {
    if (!search || !submitLock.tryAcquire()) {
      return;
    }

    setFormError(null);

    try {
      const result = await updateSavedSearch(search.id, input);
      setSavedSearchId(result.search.id);
      bumpSearchCatalog();
      if (isDiscoveryPending(result.discovery.status)) {
        beginPendingDiscovery(result.search.id);
      }
      if (isDiscoveryWarning(result.discovery.status)) {
        Alert.alert(searchesCopy.savedAlertTitle, PARTIAL_DISCOVERY_MESSAGE);
      }
      router.replace('/jobs' as Href);
    } catch (caught) {
      setFormError(userErrorMessage(caught, searchesCopy.updateError));
    } finally {
      submitLock.release();
    }
  };

  if (isLoading) {
    return (
      <ScreenScaffold>
        <SearchBackButton onPress={() => router.back()} />
        <LoadingState />
      </ScreenScaffold>
    );
  }

  if (error || !search) {
    return (
      <ScreenScaffold>
        <SearchBackButton onPress={() => router.back()} />
        <ErrorState
          title={searchesCopy.notFound}
          message={
            typeof __DEV__ !== 'undefined' && __DEV__ && error
              ? error
              : searchesCopy.notAvailable
          }
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <SearchBackButton onPress={() => router.back()} />
      <ScreenHeader
        title={searchesCopy.editTitle}
        subtitle={searchesCopy.editSubtitle}
      />
      <SavedSearchForm
        key={search.updatedAt}
        initialSearch={search}
        submitLabel={searchesCopy.saveChanges}
        submittingLabel={searchesCopy.saveSearch}
        formError={formError}
        onSubmit={onSubmit}
      />
    </ScreenScaffold>
  );
}
