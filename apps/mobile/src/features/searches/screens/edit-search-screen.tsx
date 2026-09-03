import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useJobsFilterStore } from '@/features/jobs/stores/jobs-filter.store';
import { useProfileLocation } from '@/features/profile/hooks/useProfileLocation';
import { useTheme } from '@/hooks/use-theme';
import { userErrorMessage } from '@/lib/api-error';

import { SavedSearchForm } from '../components/saved-search-form';
import { SearchBackButton } from '../components/search-back-button';
import { searchesCopy } from '../copy';
import { useSavedSearch } from '../hooks/useSavedSearches';
import { updateSavedSearch } from '../services/saved-search.service';
import type { SavedSearchWriteInput } from '../types/search.types';
import {
  createSubmitLock,
  isDiscoveryWarning,
  PARTIAL_DISCOVERY_MESSAGE,
  shouldRefreshAfterSearchWrite,
} from '../utils/search-write';

export function EditSearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const setSavedSearchId = useJobsFilterStore((state) => state.setSavedSearchId);
  const bumpSearchCatalog = useJobsFilterStore((state) => state.bumpSearchCatalog);
  const { id } = useLocalSearchParams<{ id: string }>();
  const searchId = Array.isArray(id) ? id[0] : id;
  const { search, isLoading, error } = useSavedSearch(searchId);
  const profileLocation = useProfileLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const submitLock = useRef(createSubmitLock()).current;

  const onSubmit = async (input: SavedSearchWriteInput) => {
    if (!search || !submitLock.tryAcquire()) {
      return;
    }

    const willRefresh = shouldRefreshAfterSearchWrite(search, input);
    setFormError(null);
    setIsRefreshing(willRefresh);

    try {
      const result = await updateSavedSearch(search.id, input);
      setSavedSearchId(result.search.id);
      bumpSearchCatalog();
      if (isDiscoveryWarning(result.discovery.status)) {
        Alert.alert(searchesCopy.savedAlertTitle, PARTIAL_DISCOVERY_MESSAGE);
      }
      router.replace('/jobs' as Href);
    } catch (caught) {
      setFormError(userErrorMessage(caught, searchesCopy.updateError));
    } finally {
      submitLock.release();
      setIsRefreshing(false);
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
      <View>
        <SavedSearchForm
          key={search.updatedAt}
          initialSearch={search}
          profileLocation={profileLocation}
          submitLabel={searchesCopy.saveChanges}
          submittingLabel={isRefreshing ? searchesCopy.scanning : searchesCopy.saveSearch}
          formError={formError}
          onSubmit={onSubmit}
        />
        {isRefreshing ? (
          <View
            pointerEvents="auto"
            style={[styles.scanning, { backgroundColor: theme.background }]}>
            <ActivityIndicator color={theme.accent} />
            <ThemedText type="smallBold">{searchesCopy.scanning}</ThemedText>
            <ThemedText type="meta" themeColor="textSecondary">
              {searchesCopy.editSubtitle}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scanning: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
});
