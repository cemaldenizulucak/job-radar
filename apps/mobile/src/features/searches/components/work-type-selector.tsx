import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Borders, Radius, Spacing } from '@/constants/theme';
import { pressOpacity } from '@/constants/ui';
import { useTheme } from '@/hooks/use-theme';

import { searchesCopy, workTypeLabel } from '../copy';
import type { WorkType } from '../types/search.types';
import { WORK_TYPES } from '../validation/search.schema';

type WorkTypeSelectorProps = {
  selected: readonly WorkType[];
  onChange: (next: WorkType[]) => void;
  disabled?: boolean;
};

export function WorkTypeSelector({
  selected,
  onChange,
  disabled = false,
}: WorkTypeSelectorProps) {
  const theme = useTheme();

  const toggle = (id: WorkType) => {
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
      <ThemedText type="smallBold">{searchesCopy.workTypes}</ThemedText>
      <ThemedText type="meta" themeColor="textSecondary">
        {searchesCopy.workTypesHint}
      </ThemedText>
      <View style={styles.row}>
        {WORK_TYPES.map((id) => {
          const isSelected = selected.includes(id);

          return (
            <Pressable
              key={id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              disabled={disabled}
              onPress={() => toggle(id)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? theme.accentMuted
                    : theme.backgroundElement,
                  borderColor: isSelected ? theme.accent : theme.border,
                  opacity: pressOpacity(pressed, disabled),
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: isSelected ? theme.accent : theme.text }}>
                {workTypeLabel(id)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
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
    borderRadius: Radius.md,
    borderWidth: Borders.hairline,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
