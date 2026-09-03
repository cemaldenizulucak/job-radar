import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Borders, Radius, Spacing } from '@/constants/theme';
import { pressOpacity } from '@/constants/ui';
import { getJobSourceAppearance } from '@/features/jobs/utils/job-source-appearance';
import { useTheme } from '@/hooks/use-theme';

import { searchesCopy } from '../copy';
import type { SearchSourceId } from '../types/search.types';

type SourceSelectorProps = {
  selected: readonly SearchSourceId[];
  onChange: (next: SearchSourceId[]) => void;
  error?: string;
  disabled?: boolean;
};

const SOURCE_OPTIONS: { id: SearchSourceId; label: string }[] = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'kariyer_net', label: 'Kariyer.net' },
];

export function SourceSelector({
  selected,
  onChange,
  error,
  disabled = false,
}: SourceSelectorProps) {
  const theme = useTheme();

  const toggle = (id: SearchSourceId) => {
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
      <ThemedText type="smallBold">{searchesCopy.sources}</ThemedText>
      <View style={styles.row}>
        {SOURCE_OPTIONS.map((option) => {
          const isSelected = selected.includes(option.id);
          const appearance = getJobSourceAppearance(option.id, theme.scheme);

          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              disabled={disabled}
              onPress={() => toggle(option.id)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: isSelected
                    ? appearance.badgeBackground
                    : theme.backgroundElement,
                  borderColor: isSelected ? appearance.accentColor : theme.border,
                  borderLeftColor: appearance.accentColor,
                  opacity: pressOpacity(pressed, disabled),
                },
              ]}>
              <ThemedText type="cardTitle" style={{ color: appearance.badgeTextColor }}>
                {option.label}
              </ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {isSelected ? searchesCopy.selectedSource : searchesCopy.unselectedSource}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <ThemedText type="meta" style={{ color: theme.danger }}>
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
    gap: Spacing.two,
  },
  card: {
    borderRadius: Radius.md,
    borderWidth: Borders.hairline,
    borderLeftWidth: Borders.accent,
    padding: Spacing.three,
    gap: Spacing.half,
  },
});
