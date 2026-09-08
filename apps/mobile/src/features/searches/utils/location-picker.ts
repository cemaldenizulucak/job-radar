export type LocationSelectOption = {
  value: string;
  label: string;
};

export type LocationCatalogItem = {
  code: string;
  name: string;
};

export type LocationPickerView = 'loading' | 'error' | 'list';

export const LOCATION_ALL_VALUE = '';

export function catalogToSelectOptions(
  items: readonly LocationCatalogItem[],
  allLabel: string,
): LocationSelectOption[] {
  return [
    { value: LOCATION_ALL_VALUE, label: allLabel },
    ...items.map((item) => ({ value: item.code, label: item.name })),
  ];
}

export function filterSelectOptions(
  options: readonly LocationSelectOption[],
  query: string,
): LocationSelectOption[] {
  const needle = query.trim().toLocaleLowerCase('tr');
  if (!needle) {
    return [...options];
  }

  return options.filter((option) =>
    option.label.toLocaleLowerCase('tr').includes(needle),
  );
}

export function locationPickerView(input: {
  loading: boolean;
  error: string | null;
}): LocationPickerView {
  if (input.loading) {
    return 'loading';
  }

  if (input.error) {
    return 'error';
  }

  return 'list';
}

export function closeLocationPicker(): { open: false; query: '' } {
  return { open: false, query: '' };
}

export function selectedLocationLabel(input: {
  value: string;
  options: readonly LocationSelectOption[];
  selectedLabel?: string;
  placeholder: string;
}): string {
  if (!input.value) {
    return input.placeholder;
  }

  return (
    input.options.find((option) => option.value === input.value)?.label ??
    input.selectedLabel ??
    input.placeholder
  );
}

export function toggleMultiSelectValue(
  selected: readonly string[],
  value: string,
): string[] {
  if (value === LOCATION_ALL_VALUE) {
    return [];
  }

  if (selected.includes(value)) {
    return selected.filter((item) => item !== value);
  }

  return [...selected, value];
}

export function isMultiSelectAll(selected: readonly string[]): boolean {
  return selected.length === 0;
}

export function labelsForSelectedValues(
  selected: readonly string[],
  options: readonly LocationSelectOption[],
  fallbackLabels: readonly string[] = [],
): string[] {
  return selected.map((value, index) => {
    return (
      options.find((option) => option.value === value)?.label ??
      fallbackLabels[index] ??
      value
    );
  });
}
