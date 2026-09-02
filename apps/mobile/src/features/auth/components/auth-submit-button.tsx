import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type PressableProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

const ACCENT = '#208AEF';

type AuthSubmitButtonProps = PressableProps & {
  label: string;
  loading?: boolean;
};

export function AuthSubmitButton({
  label,
  loading = false,
  disabled,
  ...pressableProps
}: AuthSubmitButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      accessibilityRole="button"
      {...pressableProps}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { opacity: isDisabled ? 0.7 : pressed ? 0.88 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <ThemedText type="smallBold" style={styles.label}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
  },
});
