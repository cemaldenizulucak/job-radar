import { type Href, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

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
import { createSavedSearch } from '../services/saved-search.service';
import type { SavedSearchWriteInput } from '../types/search.types';
import {
  createSubmitLock,
  isDiscoveryWarning,
  PARTIAL_DISCOVERY_MESSAGE,
} from '../utils/search-write';

export function CreateSearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const profileLocation = useProfileLocation();
  const setSavedSearchId = useJobsFilterStore((state) => state.setSavedSearchId);
  const bumpSearchCatalog = useJobsFilterStore((state) => state.bumpSearchCatalog);
  const [formError, setFormError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const submitLock = useRef(createSubmitLock()).current;

  const onSubmit = async (input: SavedSearchWriteInput) => {
    if (!submitLock.tryAcquire()) {
      return;
    }

    setFormError(null);
    setIsScanning(input.isActive);

    try {
      const result = await createSavedSearch(input);
      setSavedSearchId(result.search.id);
      bumpSearchCatalog();
      if (isDiscoveryWarning(result.discovery.status)) {
        Alert.alert(searchesCopy.savedAlertTitle, PARTIAL_DISCOVERY_MESSAGE);
      }
      router.replace('/jobs' as Href);
    } catch (error) {
      setFormError(userErrorMessage(error, searchesCopy.createError));
    } finally {
      submitLock.release();
      setIsScanning(false);
    }
  };

  return (
    <ScreenScaffold>
      <SearchBackButton onPress={() => router.back()} />
      <ScreenHeader
        title={searchesCopy.createTitle}
        subtitle={searchesCopy.createSubtitle}
      />
      <View>
        <SavedSearchForm
          profileLocation={profileLocation}
          submitLabel={searchesCopy.saveSearch}
          submittingLabel={searchesCopy.scanning}
          formError={formError}
          onSubmit={onSubmit}
        />
        {isScanning ? (
          <View
            pointerEvents="auto"
            style={[styles.scanning, { backgroundColor: theme.background }]}>
            <ActivityIndicator color={theme.accent} />
            <ThemedText type="smallBold">{searchesCopy.scanning}</ThemedText>
            <ThemedText type="meta" themeColor="textSecondary">
              {searchesCopy.scanningHint}
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
