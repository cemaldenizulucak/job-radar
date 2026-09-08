import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, Switch, View } from 'react-native';

import { AppBadge } from '@/components/app-badge';
import { AppButton } from '@/components/app-button';
import { SectionCard } from '@/components/section-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { searchesCopy } from '../copy';
import type { SavedSearch, SavedSearchWriteInput } from '../types/search.types';
import {
  coalesceSubdivisionCodes,
  coalesceSubdivisionNames,
  formValuesToWriteInput,
  joinTags,
  previewTags,
  savedSearchFormSchema,
  type SavedSearchFormValues,
} from '../validation/search.schema';
import { SearchLocationFields } from './search-location-fields';
import { SearchTextField } from './search-text-field';
import { SourceSelector } from './source-selector';

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
      countryCode: '',
      countryName: '',
      subdivisionCodes: [],
      subdivisionNames: [],
      experienceLevels: '',
      workTypes: [],
      sources: ['linkedin', 'kariyer_net'],
      isActive: true,
    };
  }

  return {
    name: search.name,
    keywords: joinTags(search.keywords),
    countryCode: search.countryCode ?? '',
    countryName: search.countryName ?? '',
    subdivisionCodes: coalesceSubdivisionCodes(search),
    subdivisionNames: coalesceSubdivisionNames(search),
    experienceLevels: joinTags(search.experienceLevels),
    workTypes: [],
    sources: [...search.sources],
    isActive: search.isActive,
  };
}

function TagPreview({ value }: { value: string }) {
  const theme = useTheme();
  const tags = previewTags(value);

  if (tags.length === 0) {
    return null;
  }

  return (
    <View style={styles.tags}>
      {tags.map((tag) => (
        <AppBadge
          key={tag}
          label={tag}
          backgroundColor={theme.accentMuted}
          textColor={theme.accent}
        />
      ))}
    </View>
  );
}

export function SavedSearchForm({
  initialSearch,
  submitLabel,
  submittingLabel = searchesCopy.saveSearch,
  onSubmit,
  formError,
}: SavedSearchFormProps) {
  const theme = useTheme();
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SavedSearchFormValues>({
    resolver: zodResolver(savedSearchFormSchema),
    defaultValues: toDefaultValues(initialSearch),
  });

  const submit = async (values: SavedSearchFormValues) => {
    const input = formValuesToWriteInput(values);
    await onSubmit(input);
  };

  const countryCode = useWatch({ control, name: 'countryCode' }) ?? '';
  const countryName = useWatch({ control, name: 'countryName' }) ?? '';
  const subdivisionCodes = useWatch({ control, name: 'subdivisionCodes' }) ?? [];
  const subdivisionNames = useWatch({ control, name: 'subdivisionNames' }) ?? [];
  const selectedSubdivisions = subdivisionCodes.map((code, index) => ({
    code,
    name: subdivisionNames[index] ?? code,
  }));

  return (
    <View style={styles.form}>
      <SectionCard title={searchesCopy.sectionBasics}>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <SearchTextField
              label={searchesCopy.name}
              placeholder={searchesCopy.namePlaceholder}
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
            <View style={styles.fieldBlock}>
              <SearchTextField
                label={searchesCopy.keywords}
                placeholder={searchesCopy.keywordsPlaceholder}
                hint={searchesCopy.keywordsHint}
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                error={errors.keywords?.message}
                editable={!isSubmitting}
              />
              <TagPreview value={value} />
            </View>
          )}
        />
      </SectionCard>

      <SectionCard title={searchesCopy.locations}>
        <SearchLocationFields
          countryCode={countryCode}
          countryName={countryName}
          selectedSubdivisions={selectedSubdivisions}
          disabled={isSubmitting}
          onCountryChange={(code, name) => {
            setValue('countryCode', code);
            setValue('countryName', name);
            setValue('subdivisionCodes', []);
            setValue('subdivisionNames', []);
          }}
          onSubdivisionsChange={(items) => {
            setValue('subdivisionCodes', items.map((item) => item.code));
            setValue('subdivisionNames', items.map((item) => item.name));
          }}
        />
        <Controller
          control={control}
          name="experienceLevels"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.fieldBlock}>
              <SearchTextField
                label={searchesCopy.experienceLevels}
                placeholder={searchesCopy.experiencePlaceholder}
                autoCapitalize="words"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                error={errors.experienceLevels?.message}
                editable={!isSubmitting}
              />
              <TagPreview value={value} />
            </View>
          )}
        />
        <Controller
          control={control}
          name="sources"
          render={({ field: { onChange, value } }) => (
            <SourceSelector
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
            <View
              style={[
                styles.activeRow,
                {
                  backgroundColor: theme.backgroundSelected,
                  borderColor: theme.border,
                },
              ]}>
              <View style={styles.activeCopy}>
                <ThemedText type="smallBold">{searchesCopy.active}</ThemedText>
                <ThemedText type="meta" themeColor="textSecondary">
                  {searchesCopy.activeHint}
                </ThemedText>
              </View>
              <Switch
                value={value}
                disabled={isSubmitting}
                onValueChange={onChange}
                trackColor={{ false: theme.backgroundElement, true: theme.accent }}
              />
            </View>
          )}
        />
      </SectionCard>

      {formError ? (
        <ThemedText type="meta" style={{ color: theme.danger }}>
          {formError}
        </ThemedText>
      ) : null}

      <AppButton
        label={isSubmitting ? submittingLabel : submitLabel}
        loading={isSubmitting}
        onPress={handleSubmit(submit)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  fieldBlock: {
    gap: Spacing.two,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  activeCopy: {
    flex: 1,
    gap: Spacing.one,
  },
});
