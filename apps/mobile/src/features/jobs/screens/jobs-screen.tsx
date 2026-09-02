import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ChipTabs } from '@/components/chip-tabs';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useFavorites } from '@/features/favorites/hooks/useFavorites';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { useSavedSearches } from '@/features/searches/hooks/useSavedSearches';
import { useTheme } from '@/hooks/use-theme';

import { JobCard } from '../components/job-card';
import { JobsHeader } from '../components/jobs-header';
import { useJobs } from '../hooks/useJobs';
import { useJobsFilterStore, type JobsResultsView } from '../stores/jobs-filter.store';
import {
  buildSourceTabs,
  filterJobs,
  formatJobDateLabel,
  isSourceFilter,
  latestFirstDiscoveredAt,
} from '../utils/job-labels';

const RESULTS_TABS = [
  { id: 'matched', label: 'Matched' },
  { id: 'all', label: 'All Results' },
] as const;

function isResultsView(id: string): id is JobsResultsView {
  return id === 'matched' || id === 'all';
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
  const { items, isLoading, error, refetch } = useJobs(
    userId,
    resultsView === 'matched',
  );
  const { items: favorites, refetch: refetchFavorites } = useFavorites(userId);
  const { unreadCount, refetch: refetchNotifications } = useNotifications(userId);
  const { items: searches, refetch: refetchSearches } = useSavedSearches();
  const favoriteIds = useMemo(
    () => new Set(favorites.map((item) => item.jobId)),
    [favorites],
  );

  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchSearches();
      void refetchNotifications();
      void refetchFavorites();
    }, [refetch, refetchFavorites, refetchNotifications, refetchSearches]),
  );

  useEffect(() => {
    if (searchCatalogEpoch === 0 && feedRefreshEpoch === 0) {
      return;
    }

    void refetch();
    void refetchSearches();
  }, [feedRefreshEpoch, refetch, refetchSearches, searchCatalogEpoch]);

  const sourceTabs = useMemo(() => buildSourceTabs(items), [items]);
  const searchTabs = useMemo(
    () => [
      { id: 'all', label: 'All', count: items.length },
      ...searches.map((search) => ({
        id: search.id,
        label: search.name,
        count: items.filter((job) => job.matchedSearchIds.includes(search.id)).length,
      })),
    ],
    [items, searches],
  );
  const selectedSearchId =
    savedSearchId === 'all' || searches.some((search) => search.id === savedSearchId)
      ? savedSearchId
      : 'all';

  const jobs = useMemo(
    () => filterJobs(items, sourceId, selectedSearchId),
    [items, selectedSearchId, sourceId],
  );

  const lastScanLabel = formatJobDateLabel(latestFirstDiscoveredAt(items));

  return (
    <ScreenScaffold>
      <JobsHeader
        lastScanLabel={isLoading ? '…' : error ? '—' : lastScanLabel}
        statusLabel={
          isLoading ? 'Loading jobs' : error ? 'Couldn’t load jobs' : 'Jobs loaded'
        }
        unreadNotificationCount={unreadCount}
        onPressNotifications={() => router.push('/jobs/notifications' as Href)}
        onPressFavorites={() => router.push('/jobs/favorites' as Href)}
      />

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Results
        </ThemedText>
        <ChipTabs
          items={RESULTS_TABS}
          selectedId={resultsView}
          onSelect={(id) => {
            if (isResultsView(id)) {
              setResultsView(id);
            }
          }}
        />
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Source
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
          <ThemedText type="smallBold" themeColor="textSecondary">
            Saved searches
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

      {isLoading ? <ActivityIndicator color={theme.accent} /> : null}

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

      {!isLoading && !error && items.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          {resultsView === 'all'
            ? 'No collected jobs in the last 30 days.'
            : 'No matching jobs yet. New searches scan immediately; recurring scans run every two hours.'}
        </ThemedText>
      ) : null}

      {!isLoading && !error && items.length > 0 && jobs.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          No jobs for this filter. Duplicate listings are never hidden from All.
        </ThemedText>
      ) : null}

      {!isLoading && !error && jobs.length > 0 ? (
        <View style={styles.list}>
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isFavorite={favoriteIds.has(job.id)}
              showMatchStatus={resultsView === 'all'}
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
  list: {
    gap: Spacing.three,
    overflow: 'visible',
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
