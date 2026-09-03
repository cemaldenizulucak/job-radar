import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { BrandLogo } from '@/components/brand-logo';
import { ThemedText } from '@/components/themed-text';
import { BRAND_NAME } from '@/constants/branding';
import { Radius, Spacing, cardElevation } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { jobsCopy } from '../copy';
import { getJobSourceAppearance } from '../utils/job-source-appearance';

type JobsHeaderProps = {
  lastScanLabel: string;
  statusLabel: string;
  unreadNotificationCount: number;
  totalCount: number;
  linkedInCount: number;
  kariyerCount: number;
  onPressNotifications: () => void;
  onPressFavorites: () => void;
};

export function JobsHeader({
  lastScanLabel,
  statusLabel,
  unreadNotificationCount,
  totalCount,
  linkedInCount,
  kariyerCount,
  onPressNotifications,
  onPressFavorites,
}: JobsHeaderProps) {
  const theme = useTheme();
  const badgeLabel =
    unreadNotificationCount > 99 ? '99+' : String(unreadNotificationCount);
  const linkedIn = getJobSourceAppearance('linkedin', theme.scheme);
  const kariyer = getJobSourceAppearance('kariyer_net', theme.scheme);

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
      <View style={styles.metaRow}>
        <View style={[styles.dot, { backgroundColor: theme.success }]} />
        <ThemedText type="meta" themeColor="textSecondary">
          {statusLabel}
        </ThemedText>
        <ThemedText type="meta" themeColor="textSecondary">
          ·
        </ThemedText>
        <ThemedText type="meta" themeColor="textSecondary">
          {jobsCopy.lastScan} {lastScanLabel}
        </ThemedText>
      </View>
      <View style={styles.summaryRow}>
        <SummaryPill
          label={jobsCopy.summaryTotal}
          value={totalCount}
          accent={theme.accent}
          background={theme.accentMuted}
        />
        <SummaryPill
          label="LinkedIn"
          value={linkedInCount}
          accent={linkedIn.accentColor}
          background={linkedIn.badgeBackground}
        />
        <SummaryPill
          label="Kariyer.net"
          value={kariyerCount}
          accent={kariyer.accentColor}
          background={kariyer.badgeBackground}
        />
      </View>
    </View>
  );
}

function SummaryPill({
  label,
  value,
  accent,
  background,
}: {
  label: string;
  value: number;
  accent: string;
  background: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.summaryPill,
        cardElevation(theme.scheme),
        { backgroundColor: background, borderColor: theme.border },
      ]}>
      <ThemedText type="meta" style={{ color: accent }}>
        {label}
      </ThemedText>
      <ThemedText type="cardTitle" style={{ color: accent }}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
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
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  summaryPill: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    gap: Spacing.half,
  },
});
