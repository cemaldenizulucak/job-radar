import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { NotificationItem } from '../types/notification.types';

type NotificationRowProps = {
  notification: NotificationItem;
  onPress: () => void;
};

export function NotificationRow({ notification, onPress }: NotificationRowProps) {
  const theme = useTheme();
  const unread = !notification.isRead;
  const createdAt = formatNotificationDate(notification.createdAt);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.backgroundElement,
          opacity: pressed ? 0.88 : 1,
          borderColor: unread ? theme.accent : 'transparent',
        },
      ]}>
      {unread ? (
        <View style={[styles.dot, { backgroundColor: theme.accent }]} />
      ) : (
        <View style={styles.dotSpacer} />
      )}
      <View style={styles.copy}>
        <ThemedText type="smallBold">{notification.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {notification.message}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {createdAt}
        </ThemedText>
      </View>
      {unread ? (
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          New
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function formatNotificationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 16,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: 1,
  },
  copy: {
    flex: 1,
    gap: Spacing.half,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  dotSpacer: {
    width: 8,
    height: 8,
    marginTop: 6,
  },
});
