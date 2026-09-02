import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type JobDetailHeaderProps = {
  onBack: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
};

export function JobDetailHeader({
  onBack,
  isFavorite,
  onToggleFavorite,
}: JobDetailHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
        ]}>
        <ThemedText type="smallBold">Back</ThemedText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isFavorite }}
        onPress={onToggleFavorite}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: isFavorite ? theme.accent : theme.backgroundElement,
            opacity: pressed ? 0.8 : 1,
          },
        ]}>
        <ThemedText
          type="smallBold"
          style={{ color: isFavorite ? '#ffffff' : theme.text }}>
          {isFavorite ? 'Saved' : 'Save'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  button: {
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
