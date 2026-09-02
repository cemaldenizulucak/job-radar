import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useTheme } from '@/hooks/use-theme';

import { NotificationRow } from '../components/notification-row';
import { useNotifications } from '../hooks/useNotifications';

export function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id);
  const { items, isLoading, error, refetch, markRead } = useNotifications(userId);
  const [actionError, setActionError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const handlePress = useCallback(
    async (id: string, isRead: boolean) => {
      if (isRead) {
        return;
      }

      setActionError(null);
      try {
        await markRead(id);
      } catch (caught) {
        setActionError(
          caught instanceof Error
            ? caught.message
            : 'Couldn’t mark this notification as read.',
        );
      }
    },
    [markRead],
  );

  return (
    <ScreenScaffold>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.backButton,
          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 },
        ]}>
        <ThemedText type="smallBold">Back</ThemedText>
      </Pressable>

      <View style={styles.header}>
        <ThemedText style={styles.title}>Notifications</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          New-job digests from backend discovery.
        </ThemedText>
      </View>

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

      {actionError ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {actionError}
        </ThemedText>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          No notifications yet. New jobs from morning, midday, and evening scans will
          appear here.
        </ThemedText>
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <View style={styles.list}>
          {items.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onPress={() => {
                void handlePress(notification.id, notification.isRead);
              }}
            />
          ))}
        </View>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  header: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
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
