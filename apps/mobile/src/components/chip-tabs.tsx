import { ScrollView, StyleSheet } from 'react-native';

import { AppChip } from '@/components/app-chip';
import { Spacing } from '@/constants/theme';

export type ChipTabItem = {
  id: string;
  label: string;
  count?: number;
  selectedColor?: string;
};

type ChipTabsProps = {
  items: readonly ChipTabItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
};

export function ChipTabs({ items, selectedId, onSelect, compact = false }: ChipTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, compact ? styles.compactRow : null]}>
      {items.map((item) => (
        <AppChip
          key={item.id}
          accessibilityRole="tab"
          label={item.label}
          count={item.count}
          compact={compact}
          selected={item.id === selectedId}
          selectedColor={item.selectedColor}
          onPress={() => onSelect(item.id)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  compactRow: {
    paddingVertical: 0,
    gap: Spacing.one,
  },
});
