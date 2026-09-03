import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';

type AppBadgeProps = {
  label: string;
  backgroundColor: string;
  textColor: string;
  icon?: ReactNode;
};

export function AppBadge({ label, backgroundColor, textColor, icon }: AppBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      {icon}
      <ThemedText type="smallBold" style={{ color: textColor }}>
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
});
