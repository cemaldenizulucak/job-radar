import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type JobsHeaderProps = {
  lastScanLabel: string;
  statusLabel: string;
  unreadNotificationCount: number;
  onPressNotifications: () => void;
  onPressFavorites: () => void;
};

export function JobsHeader({
  lastScanLabel,
  statusLabel,
  unreadNotificationCount,
  onPressNotifications,
  onPressFavorites,
}: JobsHeaderProps) {
  const theme = useTheme();
  const badgeLabel =
    unreadNotificationCount > 99 ? '99+' : String(unreadNotificationCount);

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <ThemedText style={styles.title}>JobRadar</ThemedText>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Favorites"
            onPress={onPressFavorites}
            style={({ pressed }) => [
              styles.bell,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 },
            ]}>
            <SymbolView
              name={{ ios: 'heart.fill', android: 'favorite', web: 'favorite' }}
              size={20}
              tintColor={theme.text}
            />
          </Pressable>
          <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            unreadNotificationCount > 0
              ? `Notifications, ${unreadNotificationCount} unread`
              : 'Notifications'
          }
          onPress={onPressNotifications}
          style={({ pressed }) => [
            styles.bell,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 },
          ]}>
          <SymbolView
            name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
            size={20}
            tintColor={theme.text}
          />
          {unreadNotificationCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.accent }]}>
              <ThemedText type="smallBold" style={styles.badgeLabel}>
                {badgeLabel}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
        </View>
      </View>
      <View style={styles.metaRow}>
        <View style={[styles.dot, { backgroundColor: theme.success }]} />
        <ThemedText type="small" themeColor="textSecondary">
          {statusLabel}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          ·
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Last scan {lastScanLabel}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeLabel: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
