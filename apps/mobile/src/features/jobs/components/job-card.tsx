import { Pressable, StyleSheet, View } from 'react-native';

import { AppBadge } from '@/components/app-badge';
import { ThemedText } from '@/components/themed-text';
import { Borders, Radius, Spacing, cardElevation } from '@/constants/theme';
import { pressOpacity } from '@/constants/ui';
import { FavoriteHeartButton } from '@/features/favorites/components/favorite-heart-button';
import { useTheme } from '@/hooks/use-theme';

import { jobsCopy, isUnverifiedSourceMatch } from '../copy';
import { useJobsSeenStore } from '../stores/jobs-seen.store';
import type { JobListItem } from '../types/job.types';
import {
  jobCardAccessibilityLabel,
  jobCardAppearance,
} from '../utils/job-card-appearance';
import { formatJobListingDate } from '../utils/job-dates';
import {
  formatLocation,
  jobCardScheduleLabel,
  sourceLabel,
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
  const scheduleLabel = jobCardScheduleLabel(
    job.workModel,
    formatJobListingDate(job.publishedAt, job.firstDiscoveredAt),
  );

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
          isPossibleMatch: isUnverifiedSourceMatch(job.matchStatus),
        })}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.content,
          { opacity: onPress ? pressOpacity(pressed) : 1 },
        ]}>
        <View style={styles.body}>
          <ThemedText
            type="cardTitle"
            numberOfLines={2}
            ellipsizeMode="tail"
            style={styles.title}>
            {job.title}
          </ThemedText>
          <ThemedText
            type="meta"
            themeColor="textSecondary"
            numberOfLines={1}
            ellipsizeMode="tail">
            {job.companyName}
          </ThemedText>
        </View>

        <View style={styles.meta}>
          <ThemedText type="meta" themeColor="textSecondary" numberOfLines={1}>
            {formatLocation(job.location)}
          </ThemedText>
          <ThemedText type="meta" themeColor="textSecondary" numberOfLines={1}>
            {scheduleLabel}
          </ThemedText>
        </View>

        <View style={styles.badgeRow}>
          {appearance.isUnread ? (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no"
              style={[styles.unreadDot, { backgroundColor: theme.accent }]}
            />
          ) : null}
          {appearance.showNewBadge ? (
            <AppBadge
              compact
              label={jobsCopy.newBadge}
              backgroundColor={theme.accent}
              textColor={theme.onAccent}
            />
          ) : null}
          <AppBadge
            compact
            label={source}
            backgroundColor={sourceAppearance.badgeBackground}
            textColor={sourceAppearance.badgeTextColor}
          />
          {isUnverifiedSourceMatch(job.matchStatus) ? (
            <AppBadge
              compact
              label={jobsCopy.possibleMatchBadge}
              backgroundColor={theme.warningMuted}
              textColor={theme.text}
            />
          ) : null}
        </View>

        {relevanceLabel ? (
          <ThemedText type="meta" themeColor="textSecondary" numberOfLines={2}>
            {jobsCopy.matchedSearchLabel}: {relevanceLabel}
          </ThemedText>
        ) : null}

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
    paddingRight: 56,
    gap: Spacing.two,
  },
  body: {
    gap: 2,
    paddingRight: Spacing.two,
  },
  title: {
    flexShrink: 1,
  },
  meta: {
    gap: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
    minHeight: 20,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
