import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

type AppBadgeProps = {
  label: string;
  backgroundColor: string;
  textColor: string;
  icon?: ReactNode;
  compact?: boolean;
};

export function AppBadge({
  label,
  backgroundColor,
  textColor,
  icon,
  compact = false,
}: AppBadgeProps) {
  return (
    <View style={[styles.badge, compact ? styles.compact : null, { backgroundColor }]}>
      {icon}
      <ThemedText
        type="smallBold"
        style={{ color: textColor, fontSize: compact ? 11 : 14, lineHeight: compact ? 14 : 20 }}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  compact: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
});
