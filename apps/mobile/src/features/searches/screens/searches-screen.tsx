import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useJobs } from '@/features/jobs/hooks/useJobs';
import { useJobsFilterStore } from '@/features/jobs/stores/jobs-filter.store';
import { useTheme } from '@/hooks/use-theme';
import { userErrorMessage } from '@/lib/api-error';

import { ConfirmDialog } from '../components/confirm-dialog';
import { SavedSearchRow } from '../components/saved-search-row';
import { useSavedSearches } from '../hooks/useSavedSearches';
import type { SavedSearch } from '../types/search.types';
import {
  DELETE_SAVED_SEARCH_MESSAGE,
  DELETE_SAVED_SEARCH_TITLE,
  createSubmitLock,
  isDiscoveryWarning,
  PARTIAL_DISCOVERY_MESSAGE,
} from '../utils/search-write';

export function SearchesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { items, isLoading, error, refetch, toggleActive, removeSearch } =
    useSavedSearches();
  const { user } = useAuth();
  const { items: jobs, refetch: refetchJobs } = useJobs(user?.id);
  const clearSavedSearchIfSelected = useJobsFilterStore(
    (state) => state.clearSavedSearchIfSelected,
  );
  const bumpSearchCatalog = useJobsFilterStore((state) => state.bumpSearchCatalog);
  const matchCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      for (const searchId of job.matchedSearchIds) {
        counts.set(searchId, (counts.get(searchId) ?? 0) + 1);
      }
    }
    return counts;
  }, [jobs]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [searchToDelete, setSearchToDelete] = useState<SavedSearch | null>(null);
  const actionLock = useRef(createSubmitLock()).current;

  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchJobs();
    }, [refetch, refetchJobs]),
  );

  const handleToggle = useCallback(
    async (search: SavedSearch, isActive: boolean) => {
      if (!actionLock.tryAcquire()) {
        return;
      }

      setActionError(null);
      setPendingId(search.id);
      if (isActive) {
        setRefreshingId(search.id);
      }

      try {
        const result = await toggleActive(search.id, isActive);
        if (isActive && isDiscoveryWarning(result.discovery.status)) {
          setActionError(PARTIAL_DISCOVERY_MESSAGE);
        }
        await refetchJobs();
        bumpSearchCatalog();
      } catch (caught) {
        setActionError(userErrorMessage(caught, 'Couldn’t update this search.'));
      } finally {
        setPendingId(null);
        setRefreshingId(null);
        actionLock.release();
      }
    },
    [actionLock, bumpSearchCatalog, refetchJobs, toggleActive],
  );

  const handleDelete = useCallback(async () => {
    if (!searchToDelete || !actionLock.tryAcquire()) {
      return;
    }

    const deleted = searchToDelete;
    setSearchToDelete(null);
    setActionError(null);
    setPendingId(deleted.id);

    try {
      await removeSearch(deleted.id);
      clearSavedSearchIfSelected(deleted.id);
      await refetchJobs();
      bumpSearchCatalog();
    } catch (caught) {
      setActionError(userErrorMessage(caught, 'Couldn’t delete this search.'));
    } finally {
      setPendingId(null);
      actionLock.release();
    }
  }, [
    actionLock,
    bumpSearchCatalog,
    clearSavedSearchIfSelected,
    refetchJobs,
    removeSearch,
    searchToDelete,
  ]);

  return (
    <ScreenScaffold>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.title}>Searches</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Saved searches belong to your account. Discovery still runs on the backend.
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/searches/create' as Href)}
          style={({ pressed }) => [
            styles.newButton,
            { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
          ]}>
          <ThemedText type="smallBold" style={styles.newButtonLabel}>
            + New Search
          </ThemedText>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={theme.accent} />
      ) : null}

      {error ? (
        <View style={styles.state}>
          <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void refetch();
            }}
            style={[styles.retry, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">Retry</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {actionError ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {actionError}
        </ThemedText>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <View style={styles.state}>
          <ThemedText themeColor="textSecondary">
            Create a search to start collecting jobs from LinkedIn and Kariyer.net.
          </ThemedText>
        </View>
      ) : null}

      {!isLoading && !error ? (
        <View style={styles.list}>
          {items.map((search) => (
            <SavedSearchRow
              key={search.id}
              search={search}
              matchCount={matchCounts.get(search.id) ?? 0}
              disabled={pendingId !== null}
              isRefreshing={refreshingId === search.id}
              onPress={() => router.push(`/searches/${search.id}` as Href)}
              onEdit={() => router.push(`/searches/${search.id}/edit` as Href)}
              onDelete={() => setSearchToDelete(search)}
              onToggleActive={(isActive) => {
                void handleToggle(search, isActive);
              }}
            />
          ))}
        </View>
      ) : null}

      <ConfirmDialog
        visible={searchToDelete !== null}
        title={DELETE_SAVED_SEARCH_TITLE}
        message={DELETE_SAVED_SEARCH_MESSAGE}
        confirmLabel="Delete"
        destructive
        confirmDisabled={pendingId !== null}
        onCancel={() => setSearchToDelete(null)}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.three,
  },
  headerCopy: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  newButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  newButtonLabel: {
    color: '#ffffff',
  },
  list: {
    gap: Spacing.two,
  },
  state: {
    gap: Spacing.two,
  },
  retry: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
