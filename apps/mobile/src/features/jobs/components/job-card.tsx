import { Pressable, StyleSheet, View } from 'react-native';

import { AppBadge } from '@/components/app-badge';
import { ThemedText } from '@/components/themed-text';
import { Borders, Radius, Spacing, cardElevation } from '@/constants/theme';
import { pressOpacity } from '@/constants/ui';
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
  relevanceLabel?: string;
};

export function JobCard({
  job,
  onPress,
  isFavorite = false,
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
        styles.card,
        appearance.isUnread ? cardElevation(theme.scheme) : null,
        {
          backgroundColor: appearance.isUnread
            ? theme.backgroundSelected
            : theme.backgroundElement,
          borderColor: theme.border,
          borderLeftColor: sourceAppearance.accentColor,
          opacity: onPress ? pressOpacity(pressed) : 1,
        },
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
        {isFavorite ? (
          <AppBadge
            label={jobsCopy.favorite}
            backgroundColor={theme.accentMuted}
            textColor={theme.accent}
          />
        ) : null}
      </View>

      <View style={styles.body}>
        <ThemedText
          type="cardTitle"
          style={{ fontWeight: appearance.titleWeight }}>
          {job.title}
        </ThemedText>
        <ThemedText>{job.companyName}</ThemedText>
      </View>

      <View style={styles.meta}>
        <ThemedText type="meta" themeColor="textSecondary">
          {formatLocation(job.location)} · {workModelLabel(job.workModel)}
        </ThemedText>
        <ThemedText type="meta" themeColor="textSecondary">
          {formatJobListingDate(job.publishedAt, job.firstDiscoveredAt)}
        </ThemedText>
        {relevanceLabel ? (
          <ThemedText type="meta" themeColor="textSecondary">
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
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: Borders.hairline,
    borderLeftWidth: Borders.accent,
    padding: Spacing.three,
    gap: Spacing.two,
    overflow: 'visible',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    minHeight: 24,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  body: {
    gap: Spacing.half,
  },
  meta: {
    gap: Spacing.half,
  },
});
