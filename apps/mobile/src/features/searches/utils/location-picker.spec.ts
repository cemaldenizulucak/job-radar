import { describe, expect, it } from 'vitest';

import {
  catalogToSelectOptions,
  closeLocationPicker,
  filterSelectOptions,
  locationPickerView,
  selectedLocationLabel,
} from './location-picker';

const countries = [
  { code: 'DE', name: 'Almanya' },
  { code: 'TR', name: 'Türkiye' },
];

describe('location picker', () => {
  it('renders Tümü first then the API country list', () => {
    expect(catalogToSelectOptions(countries, 'Tümü')).toEqual([
      { value: '', label: 'Tümü' },
      { value: 'DE', label: 'Almanya' },
      { value: 'TR', label: 'Türkiye' },
    ]);
  });

  it('filters the current list by the search input and does not keep free text', () => {
    const options = catalogToSelectOptions(countries, 'Tümü');

    expect(filterSelectOptions(options, 'tür')).toEqual([
      { value: 'TR', label: 'Türkiye' },
    ]);
    expect(filterSelectOptions(options, 'xyz')).toEqual([]);
    expect(
      filterSelectOptions(options, 'İzmir').some((item) => item.value === 'İzmir'),
    ).toBe(false);
  });

  it('closes the picker after a list selection', () => {
    expect(closeLocationPicker()).toEqual({ open: false, query: '' });
  });

  it('shows loading or the catalog error instead of a Tümü-only success list', () => {
    expect(locationPickerView({ loading: true, error: null })).toBe('loading');
    expect(
      locationPickerView({ loading: false, error: 'Konum listesi yüklenemedi' }),
    ).toBe('error');
    expect(locationPickerView({ loading: false, error: null })).toBe('list');
  });

  it('keeps the selected country visible on the form', () => {
    expect(
      selectedLocationLabel({
        value: 'TR',
        options: catalogToSelectOptions(countries, 'Tümü'),
        selectedLabel: 'Türkiye',
        placeholder: 'Ülke seç',
      }),
    ).toBe('Türkiye');
    expect(
      selectedLocationLabel({
        value: '',
        options: catalogToSelectOptions([], 'Tümü'),
        placeholder: 'Ülke seç',
      }),
    ).toBe('Ülke seç');
  });
});
