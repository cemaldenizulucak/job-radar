import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Borders, Radius, Spacing, cardElevation } from '@/constants/theme';
import { pressOpacity } from '@/constants/ui';
import { formatTurkishJobDateFromIso } from '@/features/jobs/utils/job-dates';
import { useTheme } from '@/hooks/use-theme';

import type { NotificationItem } from '../types/notification.types';

type NotificationRowProps = {
  notification: NotificationItem;
  onPress: () => void;
};

export function NotificationRow({ notification, onPress }: NotificationRowProps) {
  const theme = useTheme();
  const unread = !notification.isRead;
  const createdAt = formatTurkishJobDateFromIso(notification.createdAt) ?? '';
  const accent = notification.type === 'JOB_DISCOVERY' ? theme.accent : theme.secondary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: unread }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        unread ? cardElevation(theme.scheme) : null,
        {
          backgroundColor: unread ? theme.accentMuted : theme.backgroundElement,
          borderColor: theme.border,
          borderLeftColor: accent,
          opacity: pressOpacity(pressed),
        },
      ]}>
      {unread ? (
        <View style={[styles.dot, { backgroundColor: accent }]} />
      ) : (
        <View style={styles.dotSpacer} />
      )}
      <View style={styles.copy}>
        <ThemedText type={unread ? 'cardTitle' : 'smallBold'}>
          {notification.title}
        </ThemedText>
        <ThemedText type="meta" themeColor="textSecondary">
          {notification.message}
        </ThemedText>
        {createdAt ? (
          <ThemedText type="meta" themeColor="textSecondary">
            {createdAt}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderWidth: Borders.hairline,
    borderLeftWidth: Borders.accent,
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
