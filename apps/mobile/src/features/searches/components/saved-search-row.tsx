import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { SavedSearch } from '../types/search.types';

type SavedSearchRowProps = {
  search: SavedSearch;
  matchCount?: number;
  disabled?: boolean;
  isRefreshing?: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (isActive: boolean) => void;
};

function sourceSummary(search: SavedSearch): string {
  if (search.sources.length === 0) {
    return 'No sources';
  }

  return search.sources
    .map((source) => (source === 'linkedin' ? 'LinkedIn' : 'Kariyer.net'))
    .join(' · ');
}

export function SavedSearchRow({
  search,
  matchCount,
  disabled = false,
  isRefreshing = false,
  onPress,
  onEdit,
  onDelete,
  onToggleActive,
}: SavedSearchRowProps) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${search.name}. View details.`}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.copy, { opacity: pressed ? 0.85 : 1 }]}>
        <ThemedText style={styles.name}>{search.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {sourceSummary(search)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {search.keywords.slice(0, 3).join(', ') || 'No keywords'}
        </ThemedText>
        {matchCount !== undefined ? (
          <ThemedText type="small" themeColor="textSecondary">
            {matchCount} matching job{matchCount === 1 ? '' : 's'}
          </ThemedText>
        ) : null}
      </Pressable>
      <View style={styles.status}>
        <ThemedText
          type="smallBold"
          style={{ color: search.isActive ? theme.success : theme.textSecondary }}>
          {search.isActive ? 'Active' : 'Paused'}
        </ThemedText>
        <Switch
          value={search.isActive}
          disabled={disabled}
          onValueChange={onToggleActive}
          trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
        />
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${search.name}`}
          disabled={disabled}
          onPress={onEdit}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: theme.backgroundSelected,
              opacity: disabled || pressed ? 0.7 : 1,
            },
          ]}>
          <ThemedText type="smallBold">Edit</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${search.name}`}
          disabled={disabled}
          onPress={onDelete}
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: theme.backgroundSelected,
              opacity: disabled || pressed ? 0.7 : 1,
            },
          ]}>
          <ThemedText type="smallBold" style={{ color: theme.danger }}>
            Delete
          </ThemedText>
        </Pressable>
      </View>
      {isRefreshing ? (
        <View style={styles.refreshing}>
          <ActivityIndicator color={theme.accent} />
          <ThemedText type="smallBold">Refreshing results...</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  copy: {
    gap: Spacing.one,
  },
  name: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 700,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  refreshing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
