import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Borders, Radius, Spacing } from '@/constants/theme';
import { pressOpacity } from '@/constants/ui';
import { useTheme } from '@/hooks/use-theme';

import { jobsCopy } from '../copy';

export type SavedSearchOption = {
  id: string;
  name: string;
  count: number | null;
};

type SavedSearchSelectorProps = {
  options: readonly SavedSearchOption[];
  selectedId: string;
  onSelect: (id: string) => void;
};

function optionLabel(option: SavedSearchOption): string {
  return option.count === null ? option.name : `${option.name} (${option.count})`;
}

export function SavedSearchSelector({
  options,
  selectedId,
  onSelect,
}: SavedSearchSelectorProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected =
    options.find((option) => option.id === selectedId) ?? options[0];
  if (!selected) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${jobsCopy.savedSearchSelector}, ${optionLabel(selected)}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            opacity: pressOpacity(pressed),
          },
        ]}>
        <View style={styles.triggerText}>
          <ThemedText type="meta" themeColor="textSecondary">
            {jobsCopy.savedSearchSelector}
          </ThemedText>
          <ThemedText type="smallBold" numberOfLines={1} ellipsizeMode="tail">
            {optionLabel(selected)}
          </ThemedText>
        </View>
        <SymbolView
          name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
          size={18}
          tintColor={theme.textSecondary}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={jobsCopy.back}
          onPress={() => setOpen(false)}
          style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}>
            <ThemedText type="sectionTitle">{jobsCopy.savedSearchSelector}</ThemedText>
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {options.map((option) => {
                const selectedOption = option.id === selectedId;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityLabel={optionLabel(option)}
                    accessibilityState={{ selected: selectedOption }}
                    onPress={() => {
                      onSelect(option.id);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: selectedOption
                          ? theme.backgroundSelected
                          : 'transparent',
                        opacity: pressOpacity(pressed),
                      },
                    ]}>
                    <ThemedText
                      type={selectedOption ? 'smallBold' : 'small'}
                      style={styles.optionName}>
                      {option.name}
                    </ThemedText>
                    {option.count !== null ? (
                      <ThemedText type="meta" themeColor="textSecondary">
                        {option.count}
                      </ThemedText>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minWidth: 0,
  },
  trigger: {
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: Borders.hairline,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  triggerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheet: {
    maxHeight: '70%',
    borderRadius: Radius.lg,
    borderWidth: Borders.hairline,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  list: {
    maxHeight: 360,
  },
  option: {
    minHeight: 44,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  optionName: {
    flex: 1,
    minWidth: 0,
  },
});
