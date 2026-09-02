import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChipTabItem = {
  id: string;
  label: string;
  count?: number;
};

type ChipTabsProps = {
  items: readonly ChipTabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export function ChipTabs({ items, selectedId, onSelect }: ChipTabsProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {items.map((item) => {
        const selected = item.id === selectedId;

        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? theme.accent : theme.backgroundElement,
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: selected ? '#ffffff' : theme.text }}>
              {item.label}
            </ThemedText>
            {item.count !== undefined ? (
              <ThemedText
                type="small"
                style={{ color: selected ? '#ffffff' : theme.textSecondary }}>
                {item.count}
              </ThemedText>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
});
