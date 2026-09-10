import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { BrandLogo } from '@/components/brand-logo';
import { ThemedText } from '@/components/themed-text';
import { BRAND_NAME } from '@/constants/branding';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { jobsCopy } from '../copy';

type JobsHeaderProps = {
  statusLine: string;
  unreadNotificationCount: number;
  onPressNotifications: () => void;
  onPressFavorites: () => void;
};

export function JobsHeader({
  statusLine,
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
        <View style={styles.title}>
          <BrandLogo variant="header" accessibilityLabel={BRAND_NAME} />
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={jobsCopy.favorites}
            onPress={onPressFavorites}
            style={({ pressed }) => [
              styles.iconButton,
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
                ? jobsCopy.notificationsUnread(unreadNotificationCount)
                : jobsCopy.notifications
            }
            onPress={onPressNotifications}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 },
            ]}>
            <SymbolView
              name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
              size={20}
              tintColor={theme.text}
            />
            {unreadNotificationCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: theme.accent }]}>
                <ThemedText type="smallBold" style={{ color: theme.onAccent, fontSize: 11, lineHeight: 14 }}>
                  {badgeLabel}
                </ThemedText>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>
      <ThemedText type="meta" themeColor="textSecondary" numberOfLines={1}>
        {statusLine}
      </ThemedText>
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
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
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
});
