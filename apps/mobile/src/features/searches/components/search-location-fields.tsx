import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Spacing } from '@/constants/theme';
import {
  listCountries,
  listSubdivisions,
} from '@/features/locations/services/locations.service';
import type {
  LocationCountry,
  LocationSubdivision,
} from '@/features/locations/types';

import { searchesCopy } from '../copy';
import { catalogToSelectOptions } from '../utils/location-picker';
import {
  SearchMultiSelectField,
  type SearchMultiSelectItem,
} from './search-multi-select-field';
import { SearchSelectField } from './search-select-field';

type SearchLocationFieldsProps = {
  countryCode: string;
  countryName: string;
  selectedSubdivisions: readonly SearchMultiSelectItem[];
  disabled?: boolean;
  onCountryChange: (code: string, name: string) => void;
  onSubdivisionsChange: (items: SearchMultiSelectItem[]) => void;
};

export function SearchLocationFields({
  countryCode,
  countryName,
  selectedSubdivisions,
  disabled = false,
  onCountryChange,
  onSubdivisionsChange,
}: SearchLocationFieldsProps) {
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [countriesError, setCountriesError] = useState<string | null>(null);
  const [subdivisions, setSubdivisions] = useState<LocationSubdivision[]>([]);
  const [subdivisionsLoading, setSubdivisionsLoading] = useState(false);
  const [subdivisionsError, setSubdivisionsError] = useState<string | null>(
    null,
  );

  const loadCountries = useCallback(async () => {
    setCountriesLoading(true);
    setCountriesError(null);
    try {
      setCountries(await listCountries());
    } catch {
      setCountries([]);
      setCountriesError(searchesCopy.locationListError);
    } finally {
      setCountriesLoading(false);
    }
  }, []);

  const loadSubdivisions = useCallback(async (code: string) => {
    if (!code) {
      setSubdivisions([]);
      setSubdivisionsError(null);
      setSubdivisionsLoading(false);
      return;
    }

    setSubdivisionsLoading(true);
    setSubdivisionsError(null);
    try {
      setSubdivisions(await listSubdivisions(code));
    } catch {
      setSubdivisions([]);
      setSubdivisionsError(searchesCopy.locationListError);
    } finally {
      setSubdivisionsLoading(false);
    }
  }, []);

  const countryOptions = useMemo(
    () => catalogToSelectOptions(countries, searchesCopy.locationAll),
    [countries],
  );
  const subdivisionOptions = useMemo(
    () => catalogToSelectOptions(subdivisions, searchesCopy.locationAll),
    [subdivisions],
  );

  return (
    <View style={{ gap: Spacing.two }}>
      <SearchSelectField
        label={searchesCopy.country}
        placeholder={searchesCopy.countryPlaceholder}
        hint={searchesCopy.countryHint}
        value={countryCode}
        selectedLabel={countryName}
        options={countryOptions}
        loading={countriesLoading}
        error={countriesError}
        disabled={disabled}
        onOpen={() => {
          void loadCountries();
        }}
        onRetry={() => {
          void loadCountries();
        }}
        onChange={(code, name) => {
          onCountryChange(code, code ? name : '');
          onSubdivisionsChange([]);
          if (code) {
            void loadSubdivisions(code);
          } else {
            setSubdivisions([]);
            setSubdivisionsError(null);
          }
        }}
      />
      <SearchMultiSelectField
        label={searchesCopy.subdivision}
        placeholder={searchesCopy.subdivisionPlaceholder}
        hint={searchesCopy.subdivisionHint}
        selected={selectedSubdivisions}
        options={subdivisionOptions}
        loading={subdivisionsLoading}
        error={subdivisionsError}
        disabled={disabled || !countryCode}
        onOpen={() => {
          void loadSubdivisions(countryCode);
        }}
        onRetry={() => {
          void loadSubdivisions(countryCode);
        }}
        onChange={onSubdivisionsChange}
      />
    </View>
  );
}
