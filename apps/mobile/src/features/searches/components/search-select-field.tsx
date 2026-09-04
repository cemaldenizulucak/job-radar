import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import {
  closeLocationPicker,
  filterSelectOptions,
  locationPickerView,
  selectedLocationLabel,
  type LocationSelectOption,
} from '../utils/location-picker';

export type SearchSelectOption = LocationSelectOption;

type SearchSelectFieldProps = {
  label: string;
  placeholder: string;
  hint?: string;
  value: string;
  selectedLabel?: string;
  options: readonly SearchSelectOption[];
  loading?: boolean;
  error?: string | null;
  emptyLabel?: string;
  disabled?: boolean;
  onOpen?: () => void;
  onRetry?: () => void;
  onChange: (value: string, label: string) => void;
};

export function SearchSelectField({
  label,
  placeholder,
  hint,
  value,
  selectedLabel,
  options,
  loading = false,
  error = null,
  emptyLabel = searchesCopy.locationAll,
  disabled = false,
  onOpen,
  onRetry,
  onChange,
}: SearchSelectFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const view = locationPickerView({ loading, error });
  const display = selectedLocationLabel({
    value,
    options,
    selectedLabel,
    placeholder,
  });
  const filtered = useMemo(
    () => filterSelectOptions(options, query),
    [options, query],
  );

  const close = () => {
    const next = closeLocationPicker();
    setOpen(next.open);
    setQuery(next.query);
  };

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => {
          setOpen(true);
          onOpen?.();
        }}
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            opacity: disabled ? 0.55 : 1,
          },
        ]}>
        <ThemedText
          themeColor={value ? 'text' : 'textSecondary'}
          numberOfLines={1}>
          {display}
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
          {view === 'list' ? (
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
          ) : null}
          {view === 'loading' ? (
            <View style={styles.status}>
              <ActivityIndicator color={theme.accent} />
              <ThemedText type="smallBold">{searchesCopy.locationLoading}</ThemedText>
            </View>
          ) : null}
          {view === 'error' ? (
            <View style={styles.status}>
              <ThemedText type="smallBold">{searchesCopy.locationListError}</ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => onRetry?.()}
                style={[styles.retry, { borderColor: theme.border }]}>
                <ThemedText type="linkPrimary">{searchesCopy.locationRetry}</ThemedText>
              </Pressable>
            </View>
          ) : null}
          {view === 'list' ? (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value || 'all'}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <ThemedText type="meta" themeColor="textSecondary">
                  {searchesCopy.locationEmptyFilter}
                </ThemedText>
              }
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
          ) : null}
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
  status: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  option: {
    minHeight: 48,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
  },
});
