import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { pressOpacity } from '@/constants/ui';
import { useTheme } from '@/hooks/use-theme';

type AppChipProps = {
  label: string;
  count?: number;
  selected?: boolean;
  selectedColor?: string;
  selectedTextColor?: string;
  onPress?: () => void;
  disabled?: boolean;
  compact?: boolean;
  accessibilityRole?: 'button' | 'tab';
  accessibilityLabel?: string;
};

export function AppChip({
  label,
  count,
  selected = false,
  selectedColor,
  selectedTextColor,
  onPress,
  disabled = false,
  compact = false,
  accessibilityRole = 'button',
  accessibilityLabel,
}: AppChipProps) {
  const theme = useTheme();
  const fill = selectedColor ?? theme.accent;
  const backgroundColor = selected ? fill : theme.backgroundElement;
  const textColor = selected ? (selectedTextColor ?? theme.onAccent) : theme.text;
  const metaColor = selected ? (selectedTextColor ?? theme.onAccent) : theme.textSecondary;

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? (count === undefined ? label : `${label} ${count}`)}
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        compact ? styles.compact : null,
        {
          backgroundColor,
          borderColor: selected ? fill : theme.border,
          opacity: pressOpacity(pressed, disabled),
        },
      ]}>
      <ThemedText type="smallBold" style={{ color: textColor }}>
        {label}
      </ThemedText>
      {count !== undefined ? (
        <ThemedText type="small" style={{ color: metaColor }}>
          {count}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.full,
    borderWidth: 1,
    minHeight: 40,
  },
  compact: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    minHeight: 36,
    gap: 4,
  },
});
