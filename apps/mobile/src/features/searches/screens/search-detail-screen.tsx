import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useJobs } from '@/features/jobs/hooks/useJobs';
import { useJobsFilterStore } from '@/features/jobs/stores/jobs-filter.store';
import { useTheme } from '@/hooks/use-theme';
import { userErrorMessage } from '@/lib/api-error';

import { ConfirmDialog } from '../components/confirm-dialog';
import { SearchBackButton } from '../components/search-back-button';
import { useSavedSearch } from '../hooks/useSavedSearches';
import { deleteSavedSearch, toggleSavedSearchActive } from '../services/saved-search.service';
import {
  DELETE_SAVED_SEARCH_MESSAGE,
  DELETE_SAVED_SEARCH_TITLE,
  createSubmitLock,
  isDiscoveryWarning,
  PARTIAL_DISCOVERY_MESSAGE,
} from '../utils/search-write';

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.join(', ') : 'Any';
}

function sourceLabel(source: string): string {
  return source === 'linkedin' ? 'LinkedIn' : 'Kariyer.net';
}

function workTypeLabel(value: string): string {
  if (value === 'remote') {
    return 'Remote';
  }

  if (value === 'hybrid') {
    return 'Hybrid';
  }

  if (value === 'onsite') {
    return 'On-site';
  }

  return value;
}

export function SearchDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const searchId = Array.isArray(id) ? id[0] : id;
  const { search, isLoading, error, refetch } = useSavedSearch(searchId);
  const { user } = useAuth();
  const { items: jobs, refetch: refetchJobs } = useJobs(user?.id);
  const setSavedSearchId = useJobsFilterStore((state) => state.setSavedSearchId);
  const clearSavedSearchIfSelected = useJobsFilterStore(
    (state) => state.clearSavedSearchIfSelected,
  );
  const bumpSearchCatalog = useJobsFilterStore((state) => state.bumpSearchCatalog);
  const matchCount = useMemo(
    () =>
      search
        ? jobs.filter((job) => job.matchedSearchIds.includes(search.id)).length
        : 0,
    [jobs, search],
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const actionLock = useRef(createSubmitLock()).current;

  const handleToggle = async (isActive: boolean) => {
    if (!search || !actionLock.tryAcquire()) {
      return;
    }

    setActionError(null);
    setIsBusy(true);
    setIsRefreshing(isActive);

    try {
      const result = await toggleSavedSearchActive(search.id, isActive);
      if (isActive && isDiscoveryWarning(result.discovery.status)) {
        setActionError(PARTIAL_DISCOVERY_MESSAGE);
      }
      await refetch();
      await refetchJobs();
      bumpSearchCatalog();
    } catch (caught) {
      setActionError(userErrorMessage(caught, 'Couldn’t update this search.'));
    } finally {
      setIsBusy(false);
      setIsRefreshing(false);
      actionLock.release();
    }
  };

  const handleDelete = async () => {
    if (!search || !actionLock.tryAcquire()) {
      return;
    }

    setDeleteOpen(false);
    setActionError(null);
    setIsBusy(true);

    try {
      await deleteSavedSearch(search.id);
      clearSavedSearchIfSelected(search.id);
      await refetchJobs();
      bumpSearchCatalog();
      router.replace('/searches' as Href);
    } catch (caught) {
      setActionError(userErrorMessage(caught, 'Couldn’t delete this search.'));
      setIsBusy(false);
    } finally {
      actionLock.release();
    }
  };

  if (isLoading) {
    return (
      <ScreenScaffold>
        <SearchBackButton onPress={() => router.back()} />
        <ActivityIndicator color={theme.accent} />
      </ScreenScaffold>
    );
  }

  if (error || !search) {
    return (
      <ScreenScaffold>
        <SearchBackButton onPress={() => router.back()} />
        <ThemedText style={styles.title}>Search not found</ThemedText>
        <ThemedText themeColor="textSecondary">{error ?? 'This search is not available.'}</ThemedText>
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <SearchBackButton onPress={() => router.back()} />
      <View style={styles.header}>
        <ThemedText style={styles.title}>{search.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {`${matchCount} matching job${matchCount === 1 ? '' : 's'}`}
        </ThemedText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.activeRow}>
          <View style={styles.activeCopy}>
            <ThemedText type="smallBold">Active</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {isRefreshing
                ? 'Refreshing results...'
                : search.isActive
                  ? 'Included in backend scans.'
                  : 'Paused. Future scheduled scans are stopped. Listings are kept.'}
            </ThemedText>
          </View>
          <Switch
            value={search.isActive}
            disabled={isBusy}
            onValueChange={(value) => {
              void handleToggle(value);
            }}
            trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">Keywords</ThemedText>
        <ThemedText themeColor="textSecondary">{formatList(search.keywords)}</ThemedText>
        <ThemedText type="smallBold">Technologies</ThemedText>
        <ThemedText themeColor="textSecondary">{formatList(search.technologies)}</ThemedText>
        <ThemedText type="smallBold">Locations</ThemedText>
        <ThemedText themeColor="textSecondary">{formatList(search.locations)}</ThemedText>
        <ThemedText type="smallBold">Work types</ThemedText>
        <ThemedText themeColor="textSecondary">
          {formatList(search.workTypes.map(workTypeLabel))}
        </ThemedText>
        <ThemedText type="smallBold">Experience levels</ThemedText>
        <ThemedText themeColor="textSecondary">{formatList(search.experienceLevels)}</ThemedText>
        <ThemedText type="smallBold">Sources</ThemedText>
        <ThemedText themeColor="textSecondary">
          {search.sources.map(sourceLabel).join(', ') || 'No sources'}
        </ThemedText>
      </View>

      {actionError ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {actionError}
        </ThemedText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={() => {
          setSavedSearchId(search.id);
          router.push('/jobs' as Href);
        }}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.backgroundElement, opacity: pressed || isBusy ? 0.7 : 1 },
        ]}>
        <ThemedText type="smallBold">View jobs</ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={() => router.push(`/searches/${search.id}/edit` as Href)}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.accent, opacity: pressed || isBusy ? 0.7 : 1 },
        ]}>
        <ThemedText type="smallBold" style={styles.primaryLabel}>
          Edit
        </ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={isBusy}
        onPress={() => setDeleteOpen(true)}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.backgroundElement, opacity: pressed || isBusy ? 0.7 : 1 },
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.danger }}>
          Delete
        </ThemedText>
      </Pressable>

      <ConfirmDialog
        visible={deleteOpen}
        title={DELETE_SAVED_SEARCH_TITLE}
        message={DELETE_SAVED_SEARCH_MESSAGE}
        confirmLabel="Delete"
        destructive
        confirmDisabled={isBusy}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          void handleDelete();
        }}
      />
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
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  activeCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: '#ffffff',
  },
});
