import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SearchTextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function SearchTextField({ label, error, ...inputProps }: SearchTextFieldProps) {
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
            borderColor: hasError ? theme.danger : 'transparent',
          },
          inputProps.multiline ? styles.multiline : null,
          inputProps.style,
        ]}
      />
      {hasError ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
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
  multiline: {
    minHeight: 88,
    paddingVertical: Spacing.two,
    textAlignVertical: 'top',
  },
});
