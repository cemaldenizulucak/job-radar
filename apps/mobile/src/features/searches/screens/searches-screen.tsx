import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { uiCopy } from '@/constants/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useJobs } from '@/features/jobs/hooks/useJobs';
import { useJobsFilterStore } from '@/features/jobs/stores/jobs-filter.store';
import { useTheme } from '@/hooks/use-theme';
import { userErrorMessage } from '@/lib/api-error';

import { ConfirmDialog } from '../components/confirm-dialog';
import { SavedSearchRow } from '../components/saved-search-row';
import { searchesCopy } from '../copy';
import { useSavedSearches } from '../hooks/useSavedSearches';
import type { SavedSearch } from '../types/search.types';
import {
  DELETE_SAVED_SEARCH_MESSAGE,
  DELETE_SAVED_SEARCH_TITLE,
  createSubmitLock,
  isDiscoveryPending,
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
  const beginPendingDiscovery = useJobsFilterStore(
    (state) => state.beginPendingDiscovery,
  );
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
        if (isDiscoveryPending(result.discovery.status)) {
          beginPendingDiscovery(result.search.id);
        }
        if (isActive && isDiscoveryWarning(result.discovery.status)) {
          setActionError(PARTIAL_DISCOVERY_MESSAGE);
        }
        await refetchJobs();
        bumpSearchCatalog();
      } catch (caught) {
        setActionError(userErrorMessage(caught, searchesCopy.updateError));
      } finally {
        setPendingId(null);
        setRefreshingId(null);
        actionLock.release();
      }
    },
    [actionLock, beginPendingDiscovery, bumpSearchCatalog, refetchJobs, toggleActive],
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
      setActionError(userErrorMessage(caught, searchesCopy.deleteError));
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
      <ScreenHeader
        title={searchesCopy.screenTitle}
        subtitle={searchesCopy.subtitle}
        right={
          <AppButton
            label={searchesCopy.newSearch}
            onPress={() => router.push('/searches/create' as Href)}
          />
        }
      />

      {isLoading ? <LoadingState /> : null}

      {error ? (
        <ErrorState
          title={searchesCopy.loadError}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {actionError ? (
        <ThemedText type="meta" style={{ color: theme.danger }}>
          {actionError}
        </ThemedText>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <EmptyState title={searchesCopy.empty} />
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
        confirmLabel={uiCopy.delete}
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
  list: {
    gap: Spacing.two,
  },
});
