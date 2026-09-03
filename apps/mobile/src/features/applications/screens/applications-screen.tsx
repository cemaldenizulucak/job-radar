import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChipTabs } from '@/components/chip-tabs';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { uiCopy } from '@/constants/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getApplicationStatusAppearance } from '@/features/applications/utils/status-appearance';
import { useTheme } from '@/hooks/use-theme';

import { ApplicationRow } from '../components/application-row';
import { applicationsCopy } from '../copy';
import { useApplications } from '../hooks/useApplications';
import {
  APPLICATION_SECTION_LABELS,
  APPLICATION_SECTIONS,
  type ApplicationStatus,
} from '../types/application.types';

export function ApplicationsScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { items, isLoading, error, refetch } = useApplications(user?.id);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const visibleItems = useMemo(
    () =>
      statusFilter === 'all'
        ? items
        : items.filter((item) => item.status === statusFilter),
    [items, statusFilter],
  );

  const tabs = useMemo(
    () => [
      { id: 'all', label: uiCopy.all, count: items.length },
      ...APPLICATION_SECTIONS.map((status) => ({
        id: status,
        label: APPLICATION_SECTION_LABELS[status],
        count: items.filter((item) => item.status === status).length,
        selectedColor: getApplicationStatusAppearance(status, theme.scheme).accentColor,
      })),
    ],
    [items, theme.scheme],
  );

  return (
    <ScreenScaffold>
      <ScreenHeader
        title={applicationsCopy.screenTitle}
        subtitle={applicationsCopy.subtitle}
      />

      <ChipTabs
        items={tabs}
        selectedId={statusFilter}
        onSelect={(id) => {
          setStatusFilter(id === 'all' ? 'all' : (id as ApplicationStatus));
        }}
      />

      {isLoading ? <LoadingState /> : null}

      {error ? (
        <ErrorState
          title={applicationsCopy.loadError}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <EmptyState title={applicationsCopy.empty} />
      ) : null}

      {!isLoading && !error && items.length > 0 && visibleItems.length === 0 ? (
        <EmptyState title={applicationsCopy.emptyFilter} />
      ) : null}

      {!isLoading && !error
        ? APPLICATION_SECTIONS.filter(
            (status) =>
              statusFilter === 'all' || statusFilter === status,
          ).map((status) => {
            const sectionItems = visibleItems.filter((item) => item.status === status);
            if (statusFilter === 'all' && sectionItems.length === 0) {
              return null;
            }

            const appearance = getApplicationStatusAppearance(status, theme.scheme);

            return (
              <View key={status} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="sectionTitle" style={{ color: appearance.textColor }}>
                    {APPLICATION_SECTION_LABELS[status]}
                  </ThemedText>
                  <ThemedText type="meta" themeColor="textSecondary">
                    {sectionItems.length}
                  </ThemedText>
                </View>
                {sectionItems.length === 0 ? (
                  <ThemedText type="meta" themeColor="textSecondary">
                    {applicationsCopy.emptyFilter}
                  </ThemedText>
                ) : (
                  <View style={styles.list}>
                    {sectionItems.map((item) => (
                      <ApplicationRow key={item.id} application={item} />
                    ))}
                  </View>
                )}
              </View>
            );
          })
        : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  list: {
    gap: Spacing.two,
  },
});
