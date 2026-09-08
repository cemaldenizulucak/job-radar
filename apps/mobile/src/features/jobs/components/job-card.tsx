import { Pressable, StyleSheet, View } from 'react-native';

import { AppBadge } from '@/components/app-badge';
import { ThemedText } from '@/components/themed-text';
import { Borders, Radius, Spacing, cardElevation } from '@/constants/theme';
import { pressOpacity } from '@/constants/ui';
import { FavoriteHeartButton } from '@/features/favorites/components/favorite-heart-button';
import { useTheme } from '@/hooks/use-theme';

import { jobsCopy } from '../copy';
import { useJobsSeenStore } from '../stores/jobs-seen.store';
import type { JobListItem } from '../types/job.types';
import {
  jobCardAccessibilityLabel,
  jobCardAppearance,
} from '../utils/job-card-appearance';
import { formatJobListingDate } from '../utils/job-dates';
import {
  formatLocation,
  sourceLabel,
  workModelLabel,
} from '../utils/job-labels';
import { getJobSourceAppearance } from '../utils/job-source-appearance';

type JobCardProps = {
  job: JobListItem;
  onPress?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  relevanceLabel?: string;
};

export function JobCard({
  job,
  onPress,
  isFavorite = false,
  onToggleFavorite,
  relevanceLabel,
}: JobCardProps) {
  const theme = useTheme();
  const locallySeen = useJobsSeenStore((state) => Boolean(state.seenById[job.id]));
  const appearance = jobCardAppearance({
    isNew: job.isNew,
    isSeen: job.isSeen || locallySeen,
  });
  const showDuplicate = job.duplicateGroupSize > 1;
  const source = sourceLabel(job.sourceId);
  const sourceAppearance = getJobSourceAppearance(job.sourceId, theme.scheme);

  return (
    <View
      style={[
        styles.card,
        appearance.isUnread ? cardElevation(theme.scheme) : null,
        {
          backgroundColor: appearance.isUnread
            ? theme.backgroundSelected
            : theme.backgroundElement,
          borderColor: theme.border,
          borderLeftColor: sourceAppearance.accentColor,
        },
      ]}>
      {onToggleFavorite ? (
        <FavoriteHeartButton
          isFavorite={isFavorite}
          onToggle={onToggleFavorite}
          style={styles.heart}
        />
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={jobCardAccessibilityLabel({
          title: job.title,
          companyName: job.companyName,
          sourceLabel: source,
          isUnread: appearance.isUnread,
          isNew: appearance.showNewBadge,
          isFavorite,
          relevanceLabel,
        })}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.content,
          { opacity: onPress ? pressOpacity(pressed) : 1 },
        ]}>
        <View style={styles.topRow}>
          {appearance.isUnread ? (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={[styles.unreadDot, { backgroundColor: theme.accent }]}
            />
          ) : null}
          {appearance.showNewBadge ? (
            <AppBadge
              label={jobsCopy.newBadge}
              backgroundColor={theme.accent}
              textColor={theme.onAccent}
            />
          ) : null}
          <AppBadge
            label={source}
            backgroundColor={sourceAppearance.badgeBackground}
            textColor={sourceAppearance.badgeTextColor}
          />
        </View>

        <View style={styles.body}>
          <ThemedText
            type="cardTitle"
            numberOfLines={2}
            ellipsizeMode="tail"
            style={{ fontWeight: appearance.titleWeight }}>
            {job.title}
          </ThemedText>
          <ThemedText type="smallBold" numberOfLines={1} ellipsizeMode="tail">
            {job.companyName}
          </ThemedText>
        </View>

        <View style={styles.meta}>
          <ThemedText type="meta" themeColor="textSecondary" numberOfLines={1}>
            {formatLocation(job.location)}
          </ThemedText>
          <ThemedText type="meta" themeColor="textSecondary" numberOfLines={1}>
            {workModelLabel(job.workModel)} ·{' '}
            {formatJobListingDate(job.publishedAt, job.firstDiscoveredAt)}
          </ThemedText>
          {relevanceLabel ? (
            <ThemedText type="meta" themeColor="textSecondary" numberOfLines={2}>
              {jobsCopy.matchedSearchLabel}: {relevanceLabel}
            </ThemedText>
          ) : null}
        </View>

        {showDuplicate ? (
          <ThemedText type="meta" themeColor="textSecondary">
            {jobsCopy.otherSourcesCount(job.duplicateGroupSize)}
          </ThemedText>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: Radius.lg,
    borderWidth: Borders.hairline,
    borderLeftWidth: Borders.accent,
    overflow: 'visible',
  },
  heart: {
    position: 'absolute',
    top: Spacing.one,
    right: Spacing.one,
    zIndex: 2,
  },
  content: {
    padding: Spacing.three,
    paddingRight: 52,
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    minHeight: 24,
    paddingRight: Spacing.two,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  body: {
    gap: Spacing.one,
  },
  meta: {
    gap: Spacing.half,
  },
});
