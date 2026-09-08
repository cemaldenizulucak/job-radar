import { useEffect, useMemo, useState } from 'react';
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

import { AppBadge } from '@/components/app-badge';
import { AppButton } from '@/components/app-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { searchesCopy } from '../copy';
import {
  LOCATION_ALL_VALUE,
  closeLocationPicker,
  filterSelectOptions,
  isMultiSelectAll,
  labelsForSelectedValues,
  locationPickerView,
  toggleMultiSelectValue,
  type LocationSelectOption,
} from '../utils/location-picker';

export type SearchMultiSelectItem = {
  code: string;
  name: string;
};

type SearchMultiSelectFieldProps = {
  label: string;
  placeholder: string;
  hint?: string;
  selected: readonly SearchMultiSelectItem[];
  options: readonly LocationSelectOption[];
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  onOpen?: () => void;
  onRetry?: () => void;
  onChange: (items: SearchMultiSelectItem[]) => void;
};

export function SearchMultiSelectField({
  label,
  placeholder,
  hint,
  selected,
  options,
  loading = false,
  error = null,
  disabled = false,
  onOpen,
  onRetry,
  onChange,
}: SearchMultiSelectFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draftCodes, setDraftCodes] = useState<string[]>(
    selected.map((item) => item.code),
  );
  const view = locationPickerView({ loading, error });
  const selectedNames = selected.map((item) => item.name);
  const display =
    selected.length === 0
      ? searchesCopy.locationAll
      : selectedNames.join(', ') || placeholder;
  const filtered = useMemo(
    () => filterSelectOptions(options, query),
    [options, query],
  );

  useEffect(() => {
    if (open) {
      setDraftCodes(selected.map((item) => item.code));
    }
  }, [open, selected]);

  const close = () => {
    const next = closeLocationPicker();
    setOpen(next.open);
    setQuery(next.query);
  };

  const apply = () => {
    const names = labelsForSelectedValues(
      draftCodes,
      options,
      selectedNames,
    );
    onChange(
      draftCodes.map((code, index) => ({
        code,
        name: names[index] ?? code,
      })),
    );
    close();
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
          themeColor={selected.length > 0 ? 'text' : 'textSecondary'}
          numberOfLines={2}>
          {display}
        </ThemedText>
      </Pressable>
      {selected.length > 0 ? (
        <View style={styles.chips}>
          {selectedNames.map((name) => (
            <AppBadge
              key={name}
              label={name}
              backgroundColor={theme.accentMuted}
              textColor={theme.accent}
            />
          ))}
        </View>
      ) : null}
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
                const isAll = item.value === LOCATION_ALL_VALUE;
                const checked = isAll
                  ? isMultiSelectAll(draftCodes)
                  : draftCodes.includes(item.value);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    onPress={() => {
                      setDraftCodes((current) =>
                        toggleMultiSelectValue(current, item.value),
                      );
                    }}
                    style={[
                      styles.option,
                      {
                        backgroundColor: checked
                          ? theme.accentMuted
                          : 'transparent',
                      },
                    ]}>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: checked ? theme.accent : theme.border,
                          backgroundColor: checked ? theme.accent : 'transparent',
                        },
                      ]}>
                      {checked ? (
                        <ThemedText
                          type="smallBold"
                          style={{ color: theme.onAccent }}>
                          ✓
                        </ThemedText>
                      ) : null}
                    </View>
                    <ThemedText
                      type={checked ? 'smallBold' : 'default'}
                      themeColor={checked ? 'accent' : 'text'}>
                      {item.label}
                    </ThemedText>
                  </Pressable>
                );
              }}
            />
          ) : null}
          <AppButton
            label={searchesCopy.applyPicker}
            disabled={view !== 'list'}
            onPress={apply}
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
