import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SearchBackButtonProps = {
  onPress: () => void;
};

export function SearchBackButton({ onPress }: SearchBackButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
      ]}>
      <ThemedText type="smallBold">Back</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
