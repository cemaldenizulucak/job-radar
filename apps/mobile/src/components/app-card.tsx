import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { cardElevation, Radius, Spacing } from '@/constants/theme';
import { pressOpacity } from '@/constants/ui';
import { useTheme } from '@/hooks/use-theme';

type AppCardProps = {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  accessibilityLabel?: string;
  elevated?: boolean;
};

export function AppCard({
  children,
  style,
  onPress,
  accessibilityLabel,
  elevated = true,
}: AppCardProps) {
  const theme = useTheme();
  const cardStyle = [
    styles.card,
    elevated ? cardElevation(theme.scheme) : null,
    {
      backgroundColor: theme.backgroundElement,
      borderColor: theme.border,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [...cardStyle, { opacity: pressOpacity(pressed) }]}>
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    overflow: 'visible',
  },
});
