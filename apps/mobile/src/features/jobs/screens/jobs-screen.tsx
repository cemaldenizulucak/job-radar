import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
import { SavedSearchSelector } from '../components/saved-search-selector';
import {
  jobsCopy,
  jobsEmptyMessage,
  matchResultsTabLabel,
  sourceFilterLabel,
} from '../copy';
import { useJobs } from '../hooks/useJobs';
import { usePendingDiscovery } from '../hooks/usePendingDiscovery';
import { useJobsFilterStore, type JobsResultsView } from '../stores/jobs-filter.store';
import type { JobListItem } from '../types/job.types';
import { hasActiveListingFilters } from '../utils/jobs-feed-query';
import { formatJobDateLabel, isSourceFilter } from '../utils/job-labels';
import { getJobSourceAppearance } from '../utils/job-source-appearance';

function isResultsView(id: string): id is JobsResultsView {
  return id === 'matched' || id === 'possible' || id === 'all';
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
  const clearListingFilters = useJobsFilterStore((state) => state.clearListingFilters);
  const searchCatalogEpoch = useJobsFilterStore((state) => state.searchCatalogEpoch);
  const feedRefreshEpoch = useJobsFilterStore((state) => state.feedRefreshEpoch);
  const { items: searches, refetch: refetchSearches } = useSavedSearches();
  const selectedSearchId =
    savedSearchId === 'all' || searches.some((search) => search.id === savedSearchId)
      ? savedSearchId
      : 'all';
  const {
    items: jobs,
    lastDiscoveryAt,
    totalCount,
    savedSearchCounts,
    savedSearchAllCount,
    sourceCounts,
    verifiedMatchCount,
    unverifiedMatchCount,
    allMatchCount,
    countsReady,
    isLoading,
    error,
    refetch,
  } = useJobs(userId, resultsView, sourceId, selectedSearchId);
  const isDiscovering = usePendingDiscovery(refetch);
  const { unreadCount, refetch: refetchNotifications } = useNotifications(userId);
  const { isFavorite, error: favoriteError, toggleFavorite } = useFavoriteToggle();
  const searchNames = useMemo(
    () => new Map(searches.map((search) => [search.id, search.name])),
    [searches],
  );
  const hasFilters = hasActiveListingFilters({
    sourceId,
    savedSearchId: selectedSearchId,
  });
  const displayCount = useCallback(
    (count: number) => (countsReady ? count : null),
    [countsReady],
  );

  useFocusEffect(
    useCallback(() => {
      void refetch({ silent: true });
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
      jobs.map((job) => ({ jobId: job.id, isFavorite: job.isFavorite })),
    );
  }, [jobs]);

  useEffect(() => {
    if (searchCatalogEpoch === 0 && feedRefreshEpoch === 0) {
      return;
    }

    void refetch();
    void refetchSearches();
  }, [feedRefreshEpoch, refetch, refetchSearches, searchCatalogEpoch]);

  const sourceTabs = useMemo(
    () =>
      (
        [
          { id: 'all' as const, count: sourceCounts.all },
          { id: 'linkedin' as const, count: sourceCounts.linkedin },
          { id: 'kariyer_net' as const, count: sourceCounts.kariyer_net },
        ] as const
      ).map((tab) => ({
        id: tab.id,
        label: sourceFilterLabel(tab.id, displayCount(tab.count)),
        selectedColor:
          tab.id === 'all'
            ? undefined
            : getJobSourceAppearance(tab.id, theme.scheme).accentColor,
      })),
    [displayCount, sourceCounts, theme.scheme],
  );
  const searchOptions = useMemo(
    () => [
      {
        id: 'all',
        name: jobsCopy.all,
        count: displayCount(savedSearchAllCount),
      },
      ...searches.map((search) => ({
        id: search.id,
        name: search.name,
        count: displayCount(
          savedSearchCounts.find((item) => item.id === search.id)?.count ?? 0,
        ),
      })),
    ],
    [displayCount, savedSearchAllCount, savedSearchCounts, searches],
  );
  const resultsTabs = useMemo(
    () => [
      {
        id: 'matched',
        label: matchResultsTabLabel('matched', displayCount(verifiedMatchCount)),
      },
      {
        id: 'possible',
        label: matchResultsTabLabel('possible', displayCount(unverifiedMatchCount)),
      },
      {
        id: 'all',
        label: matchResultsTabLabel('all', displayCount(allMatchCount)),
      },
    ],
    [allMatchCount, displayCount, unverifiedMatchCount, verifiedMatchCount],
  );

  const lastScanLabel = lastDiscoveryAt ? formatJobDateLabel(lastDiscoveryAt) : '—';
  const statusLine = isDiscovering
    ? jobsCopy.searchingFeed
    : isLoading
      ? jobsCopy.loadingFeed
      : error
        ? jobsCopy.feedError
        : `${jobsCopy.lastScan} ${lastScanLabel}`;
  const emptyMessage = jobsEmptyMessage({
    itemCount: countsReady ? totalCount : 0,
    visibleCount: countsReady ? jobs.length : 0,
    resultsView,
    isDiscovering,
    isLoading,
    hasError: Boolean(error),
    hasActiveFilters: hasFilters,
  });
  const showSkeleton = (isLoading || !countsReady) && !error && !isDiscovering;
  const showList = !error && countsReady && jobs.length > 0;

  return (
    <ScreenScaffold>
      <JobsHeader
        statusLine={statusLine}
        unreadNotificationCount={unreadCount}
        onPressNotifications={() => router.push('/jobs/notifications' as Href)}
        onPressFavorites={() => router.push('/jobs/favorites' as Href)}
      />

      <View style={styles.filters}>
        <ChipTabs
          compact
          items={resultsTabs}
          selectedId={resultsView}
          onSelect={(id) => {
            if (isResultsView(id)) {
              setResultsView(id);
            }
          }}
        />
        {resultsView === 'possible' ? (
          <ThemedText type="meta" themeColor="textSecondary">
            {jobsCopy.possibleMatchesExplainer}
          </ThemedText>
        ) : null}
        <ChipTabs
          compact
          items={sourceTabs}
          selectedId={sourceId}
          onSelect={(id) => {
            if (isSourceFilter(id)) {
              setSourceId(id);
            }
          }}
        />
        {searchOptions.length > 1 ? (
          <SavedSearchSelector
            options={searchOptions}
            selectedId={selectedSearchId}
            onSelect={(id) => {
              setSavedSearchId(id === 'all' ? 'all' : id);
            }}
          />
        ) : null}
      </View>

      {countsReady && !error ? (
        <View style={styles.summaryRow}>
          <ThemedText type="smallBold">{jobsCopy.resultCount(totalCount)}</ThemedText>
          {hasFilters ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={jobsCopy.clearFilters}
              onPress={clearListingFilters}
              hitSlop={8}>
              <ThemedText type="linkPrimary">{jobsCopy.clearFilters}</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {showSkeleton ? <JobListSkeleton /> : null}

      {error ? (
        <ErrorState
          title={jobsCopy.feedError}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!error && emptyMessage ? (
        <EmptyState
          title={emptyMessage}
          message={hasFilters ? jobsCopy.emptyFilterHint : undefined}
        />
      ) : null}

      {favoriteError ? (
        <ThemedText type="meta" style={{ color: theme.danger }}>
          {favoriteError}
        </ThemedText>
      ) : null}

      {showList ? (
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
  filters: {
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 24,
  },
  list: {
    gap: Spacing.three,
    overflow: 'visible',
  },
});
