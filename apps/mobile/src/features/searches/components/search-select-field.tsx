import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { searchesCopy } from '../copy';

export type SearchSelectOption = {
  value: string;
  label: string;
};

type SearchSelectFieldProps = {
  label: string;
  placeholder: string;
  hint?: string;
  value: string;
  options: readonly SearchSelectOption[];
  emptyLabel?: string;
  disabled?: boolean;
  onChange: (value: string, label: string) => void;
};

export function SearchSelectField({
  label,
  placeholder,
  hint,
  value,
  options,
  emptyLabel = searchesCopy.locationAll,
  disabled = false,
  onChange,
}: SearchSelectFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((option) => option.value === value);
  const display = selected?.label ?? emptyLabel;

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('tr');
    if (!needle) {
      return options;
    }

    return options.filter((option) =>
      option.label.toLocaleLowerCase('tr').includes(needle),
    );
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            opacity: disabled ? 0.55 : 1,
          },
        ]}>
        <ThemedText
          themeColor={selected ? 'text' : 'textSecondary'}
          numberOfLines={1}>
          {value ? display : placeholder}
        </ThemedText>
      </Pressable>
      {hint ? (
        <ThemedText type="meta" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={close}>
        <SafeAreaView
          edges={['top', 'bottom', 'left', 'right']}
          style={[styles.modal, { backgroundColor: theme.background }]}>
          <View style={styles.modalHeader}>
            <ThemedText type="cardTitle">{label}</ThemedText>
            <Pressable onPress={close} accessibilityRole="button">
              <ThemedText type="linkPrimary">{searchesCopy.closePicker}</ThemedText>
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchesCopy.searchLocation}
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            autoCapitalize="none"
            style={[
              styles.search,
              {
                color: theme.text,
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
              },
            ]}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value || 'all'}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const selectedItem = item.value === value;
              return (
                <Pressable
                  onPress={() => {
                    onChange(item.value, item.label);
                    close();
                  }}
                  style={[
                    styles.option,
                    {
                      backgroundColor: selectedItem
                        ? theme.accentMuted
                        : 'transparent',
                    },
                  ]}>
                  <ThemedText
                    type={selectedItem ? 'smallBold' : 'default'}
                    themeColor={selectedItem ? 'accent' : 'text'}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  input: {
    minHeight: 48,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    justifyContent: 'center',
  },
  modal: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  search: {
    minHeight: 44,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    fontSize: 16,
  },
  option: {
    minHeight: 48,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
});
