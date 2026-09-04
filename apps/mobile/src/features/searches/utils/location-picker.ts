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
