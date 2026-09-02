import { type Href, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useJobsFilterStore } from '@/features/jobs/stores/jobs-filter.store';
import { useTheme } from '@/hooks/use-theme';
import { userErrorMessage } from '@/lib/api-error';

import { SavedSearchForm } from '../components/saved-search-form';
import { SearchBackButton } from '../components/search-back-button';
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
        Alert.alert('Search saved', PARTIAL_DISCOVERY_MESSAGE);
      }
      router.replace('/jobs' as Href);
    } catch (error) {
      setFormError(userErrorMessage(error, 'Couldn’t create this search.'));
    } finally {
      submitLock.release();
      setIsScanning(false);
    }
  };

  return (
    <ScreenScaffold>
      <SearchBackButton onPress={() => router.back()} />
      <View style={styles.header}>
        <ThemedText style={styles.title}>New search</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          We’ll scan LinkedIn and Kariyer.net as soon as you save an active search.
        </ThemedText>
      </View>
      <View>
        <SavedSearchForm
          submitLabel="Create search"
          submittingLabel="Searching LinkedIn and Kariyer.net..."
          formError={formError}
          onSubmit={onSubmit}
        />
        {isScanning ? (
          <View
            pointerEvents="auto"
            style={[styles.scanning, { backgroundColor: theme.background }]}>
            <ActivityIndicator color={theme.accent} />
            <ThemedText type="smallBold">Searching LinkedIn and Kariyer.net...</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              This can take a little while. Don’t close the app.
            </ThemedText>
          </View>
        ) : null}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  scanning: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
});
