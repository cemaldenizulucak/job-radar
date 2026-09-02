import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { SavedSearch, SavedSearchWriteInput } from '../types/search.types';
import {
  formValuesToWriteInput,
  joinTags,
  savedSearchFormSchema,
  type SavedSearchFormValues,
} from '../validation/search.schema';
import { OptionGroup } from './option-group';
import { SearchTextField } from './search-text-field';

const SOURCE_OPTIONS = [
  { id: 'linkedin' as const, label: 'LinkedIn' },
  { id: 'kariyer_net' as const, label: 'Kariyer.net' },
];

const WORK_TYPE_OPTIONS = [
  { id: 'remote' as const, label: 'Remote' },
  { id: 'hybrid' as const, label: 'Hybrid' },
  { id: 'onsite' as const, label: 'On-site' },
];

type SavedSearchFormProps = {
  initialSearch?: SavedSearch;
  submitLabel: string;
  submittingLabel?: string;
  onSubmit: (input: SavedSearchWriteInput) => Promise<void>;
  formError?: string | null;
};

function toDefaultValues(search?: SavedSearch): SavedSearchFormValues {
  if (!search) {
    return {
      name: '',
      keywords: '',
      technologies: '',
      locations: '',
      experienceLevels: '',
      workTypes: [],
      sources: ['linkedin', 'kariyer_net'],
      isActive: true,
    };
  }

  return {
    name: search.name,
    keywords: joinTags(search.keywords),
    technologies: joinTags(search.technologies),
    locations: joinTags(search.locations),
    experienceLevels: joinTags(search.experienceLevels),
    workTypes: [...search.workTypes],
    sources: [...search.sources],
    isActive: search.isActive,
  };
}

export function SavedSearchForm({
  initialSearch,
  submitLabel,
  submittingLabel = 'Saving…',
  onSubmit,
  formError,
}: SavedSearchFormProps) {
  const theme = useTheme();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SavedSearchFormValues>({
    resolver: zodResolver(savedSearchFormSchema),
    defaultValues: toDefaultValues(initialSearch),
  });

  const submit = async (values: SavedSearchFormValues) => {
    const input = formValuesToWriteInput(values);
    await onSubmit(input);
  };

  return (
    <View style={styles.form}>
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <SearchTextField
            label="Name"
            placeholder="Frontend Developer"
            autoCapitalize="words"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.name?.message}
            editable={!isSubmitting}
          />
        )}
      />
      <Controller
        control={control}
        name="keywords"
        render={({ field: { onChange, onBlur, value } }) => (
          <SearchTextField
            label="Keywords"
            placeholder="Frontend Developer, React Developer"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.keywords?.message}
            editable={!isSubmitting}
          />
        )}
      />
      <Controller
        control={control}
        name="technologies"
        render={({ field: { onChange, onBlur, value } }) => (
          <SearchTextField
            label="Technologies"
            placeholder="React, TypeScript"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.technologies?.message}
            editable={!isSubmitting}
          />
        )}
      />
      <Controller
        control={control}
        name="locations"
        render={({ field: { onChange, onBlur, value } }) => (
          <SearchTextField
            label="Locations"
            placeholder="Istanbul, Remote"
            autoCapitalize="words"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.locations?.message}
            editable={!isSubmitting}
          />
        )}
      />
      <Controller
        control={control}
        name="experienceLevels"
        render={({ field: { onChange, onBlur, value } }) => (
          <SearchTextField
            label="Experience levels"
            placeholder="Mid, Senior"
            autoCapitalize="words"
            value={value}
            onBlur={onBlur}
            onChangeText={onChange}
            error={errors.experienceLevels?.message}
            editable={!isSubmitting}
          />
        )}
      />
      <Controller
        control={control}
        name="workTypes"
        render={({ field: { onChange, value } }) => (
          <OptionGroup
            label="Work types"
            options={WORK_TYPE_OPTIONS}
            selected={value}
            onChange={onChange}
            error={errors.workTypes?.message}
            disabled={isSubmitting}
          />
        )}
      />
      <Controller
        control={control}
        name="sources"
        render={({ field: { onChange, value } }) => (
          <OptionGroup
            label="Sources"
            options={SOURCE_OPTIONS}
            selected={value}
            onChange={onChange}
            error={errors.sources?.message}
            disabled={isSubmitting}
          />
        )}
      />
      <Controller
        control={control}
        name="isActive"
        render={({ field: { onChange, value } }) => (
          <View style={styles.activeRow}>
            <View style={styles.activeCopy}>
              <ThemedText type="smallBold">Active</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Inactive searches are not included in backend scans.
              </ThemedText>
            </View>
            <Switch
              value={value}
              disabled={isSubmitting}
              onValueChange={onChange}
              trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
            />
          </View>
        )}
      />
      {formError ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {formError}
        </ThemedText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={isSubmitting}
        onPress={handleSubmit(submit)}
        style={({ pressed }) => [
          styles.submit,
          {
            backgroundColor: theme.accent,
            opacity: isSubmitting || pressed ? 0.8 : 1,
          },
        ]}>
        <ThemedText type="smallBold" style={styles.submitLabel}>
          {isSubmitting ? submittingLabel : submitLabel}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  activeCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  submit: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLabel: {
    color: '#ffffff',
    fontSize: 16,
  },
});
