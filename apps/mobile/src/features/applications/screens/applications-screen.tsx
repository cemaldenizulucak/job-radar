import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ChipTabs } from '@/components/chip-tabs';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';

import { ApplicationRow } from '../components/application-row';
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
      { id: 'all', label: 'All', count: items.length },
      ...APPLICATION_SECTIONS.map((status) => ({
        id: status,
        label: APPLICATION_SECTION_LABELS[status],
        count: items.filter((item) => item.status === status).length,
      })),
    ],
    [items],
  );

  return (
    <ScreenScaffold>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Applications</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Status is yours only. Duplicate source listings stay separate.
        </ThemedText>
      </View>

      <ChipTabs
        items={tabs}
        selectedId={statusFilter}
        onSelect={(id) => {
          setStatusFilter(id === 'all' ? 'all' : (id as ApplicationStatus));
        }}
      />

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
          Track a job from its detail screen to see it here.
        </ThemedText>
      ) : null}

      {!isLoading && !error && items.length > 0 && visibleItems.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          No applications with this status.
        </ThemedText>
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

            return (
              <View key={status} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="smallBold">
                    {APPLICATION_SECTION_LABELS[status]}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {sectionItems.length}
                  </ThemedText>
                </View>
                {sectionItems.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    No applications in this status.
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
  header: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
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
