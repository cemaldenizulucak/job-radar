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
};

export function ChipTabs({ items, selectedId, onSelect }: ChipTabsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}>
      {items.map((item) => (
        <AppChip
          key={item.id}
          accessibilityRole="tab"
          label={item.label}
          count={item.count}
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
});
