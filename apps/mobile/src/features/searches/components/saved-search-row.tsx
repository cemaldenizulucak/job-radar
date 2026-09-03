import { ActivityIndicator, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppBadge } from '@/components/app-badge';
import { AppButton } from '@/components/app-button';
import { AppCard } from '@/components/app-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { uiCopy } from '@/constants/ui';
import { useTheme } from '@/hooks/use-theme';

import { searchesCopy, sourceName, workTypeLabel } from '../copy';
import type { SavedSearch } from '../types/search.types';
import { searchLocationDisplay } from '../utils/search-location-display';

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

function filterSummary(search: SavedSearch): string {
  const location = searchLocationDisplay(search);
  const locationLabel = location.fromProfile
    ? location.label
      ? `${location.label} · ${searchesCopy.profileLocationBadge}`
      : ''
    : location.label ?? '';
  const parts = [
    search.keywords.slice(0, 3).join(', ') || searchesCopy.noKeywords,
    locationLabel,
    search.workTypes.map(workTypeLabel).join(', '),
  ].filter((part) => part.length > 0);

  return parts.join(' · ');
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
    <AppCard>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${search.name}. ${searchesCopy.viewJobs}.`}
        disabled={disabled}
        onPress={onPress}>
        <View style={styles.top}>
          <ThemedText type="cardTitle" style={styles.name}>
            {search.name}
          </ThemedText>
          <AppBadge
            label={search.isActive ? searchesCopy.active : searchesCopy.paused}
            backgroundColor={search.isActive ? theme.successMuted : theme.backgroundSelected}
            textColor={search.isActive ? theme.success : theme.textSecondary}
          />
        </View>
        <ThemedText type="meta" themeColor="textSecondary">
          {filterSummary(search)}
        </ThemedText>
      </Pressable>
      <View style={styles.sources}>
        {search.sources.map((source) => (
          <AppBadge
            key={source}
            label={sourceName(source)}
            backgroundColor={theme.backgroundSelected}
            textColor={theme.text}
          />
        ))}
        {search.sources.length === 0 ? (
          <ThemedText type="meta" themeColor="textSecondary">
            {searchesCopy.noSources}
          </ThemedText>
        ) : null}
      </View>
      {matchCount !== undefined ? (
        <ThemedText type="meta" themeColor="textSecondary">
          {searchesCopy.matchCount(matchCount)}
        </ThemedText>
      ) : null}
      <View style={styles.status}>
        <ThemedText type="smallBold">
          {search.isActive ? searchesCopy.active : searchesCopy.paused}
        </ThemedText>
        <Switch
          value={search.isActive}
          disabled={disabled}
          onValueChange={onToggleActive}
          trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
        />
      </View>
      <View style={styles.actions}>
        <AppButton
          label={uiCopy.edit}
          variant="secondary"
          disabled={disabled}
          onPress={onEdit}
          accessibilityLabel={`${uiCopy.edit} ${search.name}`}
          style={styles.action}
        />
        <AppButton
          label={uiCopy.delete}
          variant="ghost"
          disabled={disabled}
          onPress={onDelete}
          accessibilityLabel={`${uiCopy.delete} ${search.name}`}
          style={styles.action}
        />
      </View>
      {isRefreshing ? (
        <View style={styles.refreshing}>
          <ActivityIndicator color={theme.accent} />
          <ThemedText type="smallBold">{searchesCopy.scanning}</ThemedText>
        </View>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  name: {
    flex: 1,
  },
  sources: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
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
  },
  refreshing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
