import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppBadge } from '@/components/app-badge';
import { AppButton } from '@/components/app-button';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { SectionCard } from '@/components/section-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { uiCopy } from '@/constants/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useJobs } from '@/features/jobs/hooks/useJobs';
import { useJobsFilterStore } from '@/features/jobs/stores/jobs-filter.store';
import { useTheme } from '@/hooks/use-theme';
import { userErrorMessage } from '@/lib/api-error';

import { ConfirmDialog } from '../components/confirm-dialog';
import { SearchBackButton } from '../components/search-back-button';
import { searchesCopy, sourceName } from '../copy';
import { useSavedSearch } from '../hooks/useSavedSearches';
import { deleteSavedSearch, toggleSavedSearchActive } from '../services/saved-search.service';
import type { SavedSearch } from '../types/search.types';
import { searchLocationDisplay } from '../utils/search-location-display';
import {
  DELETE_SAVED_SEARCH_MESSAGE,
  DELETE_SAVED_SEARCH_TITLE,
  createSubmitLock,
  isDiscoveryPending,
  isDiscoveryWarning,
  PARTIAL_DISCOVERY_MESSAGE,
} from '../utils/search-write';

function formatList(values: readonly string[]): string {
  return values.length > 0 ? values.join(', ') : searchesCopy.any;
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
  const beginPendingDiscovery = useJobsFilterStore(
    (state) => state.beginPendingDiscovery,
  );
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
      if (isDiscoveryPending(result.discovery.status)) {
        beginPendingDiscovery(result.search.id);
      }
      if (isActive && isDiscoveryWarning(result.discovery.status)) {
        setActionError(PARTIAL_DISCOVERY_MESSAGE);
      }
      await refetch();
      await refetchJobs();
      bumpSearchCatalog();
    } catch (caught) {
      setActionError(userErrorMessage(caught, searchesCopy.updateError));
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
      setActionError(userErrorMessage(caught, searchesCopy.deleteError));
      setIsBusy(false);
    } finally {
      actionLock.release();
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
        title={search.name}
        subtitle={searchesCopy.matchCount(matchCount)}
      />

      <SectionCard title={searchesCopy.active}>
        <View style={styles.activeRow}>
          <View style={styles.activeCopy}>
            <ThemedText type="meta" themeColor="textSecondary">
              {isRefreshing
                ? searchesCopy.scanning
                : search.isActive
                  ? searchesCopy.includedInScans
                  : searchesCopy.pausedHint}
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
      </SectionCard>

      <SectionCard title={searchesCopy.sectionBasics}>
        <DetailLine label={searchesCopy.keywords} value={formatList(search.keywords)} />
        <LocationDetail search={search} />
        <ThemedText type="smallBold">{searchesCopy.sources}</ThemedText>
        <View style={styles.chipRow}>
          {search.sources.length === 0 ? (
            <ThemedText type="meta" themeColor="textSecondary">
              {searchesCopy.noSources}
            </ThemedText>
          ) : (
            search.sources.map((source) => (
              <AppBadge
                key={source}
                label={sourceName(source)}
                backgroundColor={theme.backgroundSelected}
                textColor={theme.text}
              />
            ))
          )}
        </View>
      </SectionCard>

      {search.technologies.length > 0 ||
      search.experienceLevels.length > 0 ? (
        <SectionCard title={searchesCopy.sectionAdvanced}>
          {search.technologies.length > 0 ? (
            <DetailLine
              label={searchesCopy.tags}
              value={formatList(search.technologies)}
            />
          ) : null}
          {search.experienceLevels.length > 0 ? (
            <DetailLine
              label={searchesCopy.experienceLevels}
              value={formatList(search.experienceLevels)}
            />
          ) : null}
        </SectionCard>
      ) : null}

      {actionError ? (
        <ThemedText type="meta" style={{ color: theme.danger }}>
          {actionError}
        </ThemedText>
      ) : null}

      <AppButton
        label={searchesCopy.viewJobs}
        variant="secondary"
        disabled={isBusy}
        onPress={() => {
          setSavedSearchId(search.id);
          router.push('/jobs' as Href);
        }}
      />
      <AppButton
        label={uiCopy.edit}
        disabled={isBusy}
        onPress={() => router.push(`/searches/${search.id}/edit` as Href)}
      />
      <AppButton
        label={uiCopy.delete}
        variant="danger"
        disabled={isBusy}
        onPress={() => setDeleteOpen(true)}
      />

      <ConfirmDialog
        visible={deleteOpen}
        title={DELETE_SAVED_SEARCH_TITLE}
        message={DELETE_SAVED_SEARCH_MESSAGE}
        confirmLabel={uiCopy.delete}
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

function LocationDetail({ search }: { search: SavedSearch }) {
  const location = searchLocationDisplay(search);
  const value = location.label ?? searchesCopy.any;

  return (
    <View style={styles.detail}>
      <ThemedText type="smallBold">{searchesCopy.locations}</ThemedText>
      <ThemedText themeColor="textSecondary">{value}</ThemedText>
      {location.fromProfile && location.label ? (
        <ThemedText type="meta" themeColor="textSecondary">
          {searchesCopy.profileLocationBadge}
        </ThemedText>
      ) : null}
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText themeColor="textSecondary">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  activeCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  detail: {
    gap: Spacing.half,
  },
});
