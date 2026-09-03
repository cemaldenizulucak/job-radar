import { useEffect, useMemo, useState } from 'react';
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
import { SearchSelectField, type SearchSelectOption } from './search-select-field';

type SearchLocationFieldsProps = {
  countryCode: string;
  countryName: string;
  subdivisionCode: string;
  subdivisionName: string;
  disabled?: boolean;
  onCountryChange: (code: string, name: string) => void;
  onSubdivisionChange: (code: string, name: string) => void;
};

export function SearchLocationFields({
  countryCode,
  countryName,
  subdivisionCode,
  subdivisionName,
  disabled = false,
  onCountryChange,
  onSubdivisionChange,
}: SearchLocationFieldsProps) {
  const [countries, setCountries] = useState<LocationCountry[]>([]);
  const [subdivisions, setSubdivisions] = useState<LocationSubdivision[]>([]);

  useEffect(() => {
    let cancelled = false;

    void listCountries().then((items) => {
      if (!cancelled) {
        setCountries(items);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!countryCode) {
      setSubdivisions([]);
      return;
    }

    let cancelled = false;
    void listSubdivisions(countryCode).then((items) => {
      if (!cancelled) {
        setSubdivisions(items);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [countryCode]);

  const countryOptions = useMemo(
    () =>
      withSelectedOption(
        [
          { value: '', label: searchesCopy.locationAll },
          ...countries.map((item) => ({ value: item.code, label: item.name })),
        ],
        countryCode,
        countryName,
      ),
    [countries, countryCode, countryName],
  );

  const subdivisionOptions = useMemo(
    () =>
      withSelectedOption(
        [
          { value: '', label: searchesCopy.locationAll },
          ...subdivisions.map((item) => ({
            value: item.code,
            label: item.name,
          })),
        ],
        subdivisionCode,
        subdivisionName,
      ),
    [subdivisions, subdivisionCode, subdivisionName],
  );

  return (
    <View style={{ gap: Spacing.two }}>
      <SearchSelectField
        label={searchesCopy.country}
        placeholder={searchesCopy.countryPlaceholder}
        hint={searchesCopy.countryHint}
        value={countryCode}
        options={countryOptions}
        disabled={disabled}
        onChange={(code, name) => {
          onCountryChange(code, code ? name : '');
        }}
      />
      <SearchSelectField
        label={searchesCopy.subdivision}
        placeholder={searchesCopy.subdivisionPlaceholder}
        hint={searchesCopy.subdivisionHint}
        value={subdivisionCode}
        options={subdivisionOptions}
        disabled={disabled || !countryCode}
        onChange={(code, name) => {
          onSubdivisionChange(code, code ? name : '');
        }}
      />
    </View>
  );
}

function withSelectedOption(
  options: SearchSelectOption[],
  code: string,
  name: string,
): SearchSelectOption[] {
  if (!code || options.some((option) => option.value === code)) {
    return options;
  }

  return [...options, { value: code, label: name || code }];
}
