import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AuthTextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function AuthTextField({ label, error, ...inputProps }: AuthTextFieldProps) {
  const theme = useTheme();
  const hasError = Boolean(error);

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        {...inputProps}
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: hasError ? '#D93025' : 'transparent',
          },
          inputProps.style,
        ]}
      />
      {hasError ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    borderWidth: 1,
  },
  error: {
    color: '#D93025',
    fontSize: 13,
    lineHeight: 18,
  },
});
