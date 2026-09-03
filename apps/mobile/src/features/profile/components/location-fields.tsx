import { SearchTextField } from '@/features/searches/components/search-text-field';

import { profileCopy } from '../copy';

type LocationFieldsProps = {
  country: string;
  city: string;
  onCountryChange: (value: string) => void;
  onCityChange: (value: string) => void;
  countryError?: string;
  cityError?: string;
  disabled?: boolean;
};

export function LocationFields({
  country,
  city,
  onCountryChange,
  onCityChange,
  countryError,
  cityError,
  disabled = false,
}: LocationFieldsProps) {
  return (
    <>
      <SearchTextField
        label={profileCopy.country}
        placeholder={profileCopy.countryPlaceholder}
        autoCapitalize="words"
        autoComplete="country"
        textContentType="countryName"
        value={country}
        onChangeText={onCountryChange}
        error={countryError}
        editable={!disabled}
      />
      <SearchTextField
        label={profileCopy.city}
        placeholder={profileCopy.cityPlaceholder}
        autoCapitalize="words"
        autoComplete="postal-address-locality"
        textContentType="addressCity"
        value={city}
        onChangeText={onCityChange}
        error={cityError}
        editable={!disabled}
      />
    </>
  );
}
