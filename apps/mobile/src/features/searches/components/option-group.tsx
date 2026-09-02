import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Option<T extends string> = {
  id: T;
  label: string;
};

type OptionGroupProps<T extends string> = {
  label: string;
  options: readonly Option<T>[];
  selected: readonly T[];
  onChange: (next: T[]) => void;
  error?: string;
  disabled?: boolean;
};

export function OptionGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
  error,
  disabled = false,
}: OptionGroupProps<T>) {
  const theme = useTheme();

  const toggle = (id: T) => {
    if (disabled) {
      return;
    }

    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
      return;
    }

    onChange([...selected, id]);
  };

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.row}>
        {options.map((option) => {
          const isSelected = selected.includes(option.id);

          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              disabled={disabled}
              onPress={() => toggle(option.id)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isSelected ? theme.accent : theme.backgroundElement,
                  opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: isSelected ? '#ffffff' : theme.text }}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {error ? (
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
