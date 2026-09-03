import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useJobsFilterStore } from '@/features/jobs/stores/jobs-filter.store';
import { useTheme } from '@/hooks/use-theme';

import { NotificationRow } from '../components/notification-row';
import { notificationsCopy } from '../copy';
import { useNotifications } from '../hooks/useNotifications';
import { JOB_DISCOVERY_PUSH_TYPE } from '../services/push-notification-data';
import type { NotificationItem } from '../types/notification.types';

export function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id);
  const applyDiscoveryNotificationTarget = useJobsFilterStore(
    (state) => state.applyDiscoveryNotificationTarget,
  );
  const { items, isLoading, error, refetch, markRead } = useNotifications(userId);
  const [actionError, setActionError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const handlePress = useCallback(
    async (notification: NotificationItem) => {
      setActionError(null);

      if (notification.type === JOB_DISCOVERY_PUSH_TYPE) {
        applyDiscoveryNotificationTarget(notification.data?.savedSearchId ?? null);
        router.push('/jobs' as Href);
      }

      if (notification.isRead) {
        return;
      }

      try {
        await markRead(notification.id);
      } catch (caught) {
        setActionError(
          typeof __DEV__ !== 'undefined' && __DEV__ && caught instanceof Error
            ? caught.message
            : notificationsCopy.markReadError,
        );
      }
    },
    [applyDiscoveryNotificationTarget, markRead, router],
  );

  return (
    <ScreenScaffold>
      <ScreenHeader
        title={notificationsCopy.screenTitle}
        subtitle={notificationsCopy.subtitle}
        leading={<BackButton onPress={() => router.back()} />}
      />

      {isLoading ? <LoadingState /> : null}

      {error ? (
        <ErrorState
          title={notificationsCopy.loadError}
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
        <EmptyState title={notificationsCopy.empty} />
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <View style={styles.list}>
          {items.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onPress={() => {
                void handlePress(notification);
              }}
            />
          ))}
        </View>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
});
