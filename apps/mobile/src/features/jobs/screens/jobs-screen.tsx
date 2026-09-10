import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ChipTabs } from '@/components/chip-tabs';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useFavoriteToggle } from '@/features/favorites/hooks/useFavoriteToggle';
import { useFavoritesStatusStore } from '@/features/favorites/stores/favorites-status.store';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { useSavedSearches } from '@/features/searches/hooks/useSavedSearches';
import { useTheme } from '@/hooks/use-theme';

import { JobCard } from '../components/job-card';
import { JobListSkeleton } from '../components/job-list-skeleton';
import { JobsHeader } from '../components/jobs-header';
import { jobsCopy, jobsEmptyMessage, matchResultsTabLabel } from '../copy';
import { useJobs } from '../hooks/useJobs';
import { usePendingDiscovery } from '../hooks/usePendingDiscovery';
import { useJobsFilterStore, type JobsResultsView } from '../stores/jobs-filter.store';
import type { JobListItem } from '../types/job.types';
import {
  countJobsBySourceForSearch,
  buildSourceTabs,
  filterJobs,
  formatJobDateLabel,
  isSourceFilter,
} from '../utils/job-labels';
import { getJobSourceAppearance } from '../utils/job-source-appearance';

const ALL_RESULTS_TAB = { id: 'all', label: jobsCopy.allResults } as const;

function isResultsView(id: string): id is JobsResultsView {
  return id === 'matched' || id === 'possible' || id === 'all';
}

function matchStatusForResultsView(
  resultsView: JobsResultsView,
): 'verified' | 'unverified_source_candidate' | 'all' {
  if (resultsView === 'matched') {
    return 'verified';
  }
  if (resultsView === 'possible') {
    return 'unverified_source_candidate';
  }
  return 'all';
}

function jobRelevanceLabel(
  job: JobListItem,
  searchNames: ReadonlyMap<string, string>,
): string {
  if (!job.isMatched) {
    return jobsCopy.notMatched;
  }

  const names = job.matchedSearchIds
    .map((id) => searchNames.get(id))
    .filter((name): name is string => Boolean(name));

  return names.length > 0 ? names.join(', ') : jobsCopy.matchedShort;
}

export function JobsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id);
  const sourceId = useJobsFilterStore((state) => state.sourceId);
  const savedSearchId = useJobsFilterStore((state) => state.savedSearchId);
  const resultsView = useJobsFilterStore((state) => state.resultsView);
  const setSourceId = useJobsFilterStore((state) => state.setSourceId);
  const setSavedSearchId = useJobsFilterStore((state) => state.setSavedSearchId);
  const setResultsView = useJobsFilterStore((state) => state.setResultsView);
  const searchCatalogEpoch = useJobsFilterStore((state) => state.searchCatalogEpoch);
  const feedRefreshEpoch = useJobsFilterStore((state) => state.feedRefreshEpoch);
  const { items: searches, refetch: refetchSearches } = useSavedSearches();
  const selectedSearchId =
    savedSearchId === 'all' || searches.some((search) => search.id === savedSearchId)
      ? savedSearchId
      : 'all';
  const {
    items,
    lastDiscoveryAt,
    totalCount,
    savedSearchCounts,
    verifiedMatchCount,
    unverifiedMatchCount,
    isLoading,
    error,
    refetch,
  } = useJobs(userId, resultsView !== 'all', selectedSearchId);
  const isDiscovering = usePendingDiscovery(refetch);
  const { unreadCount, refetch: refetchNotifications } = useNotifications(userId);
  const { isFavorite, error: favoriteError, toggleFavorite } = useFavoriteToggle();
  const searchNames = useMemo(
    () => new Map(searches.map((search) => [search.id, search.name])),
    [searches],
  );

  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchSearches();
      void refetchNotifications();
    }, [refetch, refetchNotifications, refetchSearches]),
  );

  useEffect(() => {
    if (!userId) {
      useFavoritesStatusStore.getState().clear();
    }
  }, [userId]);

  useEffect(() => {
    useFavoritesStatusStore.getState().hydrate(
      items.map((job) => ({ jobId: job.id, isFavorite: job.isFavorite })),
    );
  }, [items]);

  useEffect(() => {
    if (searchCatalogEpoch === 0 && feedRefreshEpoch === 0) {
      return;
    }

    void refetch();
    void refetchSearches();
  }, [feedRefreshEpoch, refetch, refetchSearches, searchCatalogEpoch]);

  const matchStatus = matchStatusForResultsView(resultsView);
  const sourceCounts = useMemo(
    () =>
      countJobsBySourceForSearch(
        filterJobs(items, 'all', selectedSearchId, matchStatus),
        'all',
      ),
    [items, matchStatus, selectedSearchId],
  );
  const sourceTabs = useMemo(
    () =>
      buildSourceTabs(filterJobs(items, 'all', selectedSearchId, matchStatus)).map(
        (tab) => ({
          ...tab,
          selectedColor:
            tab.id === 'all'
              ? undefined
              : getJobSourceAppearance(tab.id, theme.scheme).accentColor,
        }),
      ),
    [items, matchStatus, selectedSearchId, theme.scheme],
  );
  const searchTabs = useMemo(
    () => [
      { id: 'all', label: jobsCopy.all, count: totalCount },
      ...searches.map((search) => ({
        id: search.id,
        label: search.name,
        count:
          savedSearchCounts.find((item) => item.id === search.id)?.count ??
          items.filter((job) => job.matchedSearchIds.includes(search.id)).length,
      })),
    ],
    [items, savedSearchCounts, searches, totalCount],
  );
  const resultsTabs = useMemo(
    () => [
      {
        id: 'matched',
        label: matchResultsTabLabel('matched', verifiedMatchCount),
      },
      {
        id: 'possible',
        label: matchResultsTabLabel('possible', unverifiedMatchCount),
      },
      ALL_RESULTS_TAB,
    ],
    [unverifiedMatchCount, verifiedMatchCount],
  );
  const jobs = useMemo(
    () => filterJobs(items, sourceId, selectedSearchId, matchStatus),
    [items, matchStatus, selectedSearchId, sourceId],
  );
  const tabItemCount = useMemo(
    () => filterJobs(items, 'all', selectedSearchId, matchStatus).length,
    [items, matchStatus, selectedSearchId],
  );

  const lastScanLabel = lastDiscoveryAt ? formatJobDateLabel(lastDiscoveryAt) : '—';
  const emptyMessage = jobsEmptyMessage({
    itemCount: tabItemCount,
    visibleCount: jobs.length,
    resultsView,
    isDiscovering,
  });

  return (
    <ScreenScaffold>
      <JobsHeader
        lastScanLabel={isLoading ? '…' : error ? '—' : lastScanLabel}
        statusLabel={
          isDiscovering
            ? jobsCopy.searchingFeed
            : isLoading
              ? jobsCopy.loadingFeed
              : error
                ? jobsCopy.feedError
                : jobsCopy.jobsLoaded
        }
        unreadNotificationCount={unreadCount}
        totalCount={sourceCounts.total}
        linkedInCount={sourceCounts.linkedin}
        kariyerCount={sourceCounts.kariyerNet}
        onPressNotifications={() => router.push('/jobs/notifications' as Href)}
        onPressFavorites={() => router.push('/jobs/favorites' as Href)}
      />

      <View style={styles.section}>
        <ThemedText type="sectionTitle" themeColor="textSecondary">
          {jobsCopy.results}
        </ThemedText>
        <ChipTabs
          items={resultsTabs}
          selectedId={resultsView}
          onSelect={(id) => {
            if (isResultsView(id)) {
              setResultsView(id);
            }
          }}
        />
      </View>

      <View style={styles.section}>
        <ThemedText type="sectionTitle" themeColor="textSecondary">
          {jobsCopy.source}
        </ThemedText>
        <ChipTabs
          items={sourceTabs}
          selectedId={sourceId}
          onSelect={(id) => {
            if (isSourceFilter(id)) {
              setSourceId(id);
            }
          }}
        />
      </View>

      {searchTabs.length > 1 ? (
        <View style={styles.section}>
          <ThemedText type="sectionTitle" themeColor="textSecondary">
            {jobsCopy.savedSearches}
          </ThemedText>
          <ChipTabs
            items={searchTabs}
            selectedId={selectedSearchId}
            onSelect={(id) => {
              setSavedSearchId(id === 'all' ? 'all' : id);
            }}
          />
        </View>
      ) : null}

      {isDiscovering ? (
        <View style={styles.searching}>
          <ActivityIndicator color={theme.accent} />
          <ThemedText type="smallBold">{jobsCopy.searchingFeed}</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            {jobsCopy.searchingFeedHint}
          </ThemedText>
        </View>
      ) : null}

      {isLoading && !isDiscovering && jobs.length === 0 ? (
        <JobListSkeleton />
      ) : null}

      {error ? (
        <ErrorState
          title={jobsCopy.feedError}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isLoading && !error && !isDiscovering && emptyMessage ? (
        <EmptyState title={emptyMessage} />
      ) : null}

      {favoriteError ? (
        <ThemedText type="meta" style={{ color: theme.danger }}>
          {favoriteError}
        </ThemedText>
      ) : null}

      {!error && jobs.length > 0 ? (
        <View style={styles.list}>
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isFavorite={isFavorite(job.id, job.isFavorite)}
              onToggleFavorite={() => {
                void toggleFavorite(job.id, isFavorite(job.id, job.isFavorite));
              }}
              relevanceLabel={
                resultsView === 'all' ? jobRelevanceLabel(job, searchNames) : undefined
              }
              onPress={() => router.push(`/jobs/${job.id}` as Href)}
            />
          ))}
        </View>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.one,
  },
  searching: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  list: {
    gap: Spacing.three,
    overflow: 'visible',
  },
});
