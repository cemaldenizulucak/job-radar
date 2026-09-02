import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useJobsSeenStore } from '../stores/jobs-seen.store';
import type { JobListItem } from '../types/job.types';
import {
  jobCardAccessibilityLabel,
  jobCardAppearance,
} from '../utils/job-card-appearance';
import {
  formatJobDateLabel,
  formatLocation,
  sourceLabel,
  workModelLabel,
} from '../utils/job-labels';

type JobCardProps = {
  job: JobListItem;
  onPress?: PressableProps['onPress'];
  isFavorite?: boolean;
  showMatchStatus?: boolean;
};

export function JobCard({
  job,
  onPress,
  isFavorite = false,
  showMatchStatus = false,
}: JobCardProps) {
  const theme = useTheme();
  const locallySeen = useJobsSeenStore((state) => Boolean(state.seenById[job.id]));
  const appearance = jobCardAppearance({
    isNew: job.isNew,
    isSeen: job.isSeen || locallySeen,
  });
  const showDuplicate = job.duplicateGroupSize > 1;
  const matchLabel = job.isMatched ? 'Matched' : 'Not matched';
  const chipBackground = appearance.isUnread
    ? theme.backgroundElement
    : theme.backgroundSelected;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={jobCardAccessibilityLabel({
        title: job.title,
        companyName: job.companyName,
        isUnread: appearance.isUnread,
        isNew: appearance.showNewBadge,
        isFavorite,
        matchLabel: showMatchStatus ? matchLabel : undefined,
      })}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        appearance.isUnread ? unreadElevation : null,
        {
          backgroundColor: appearance.isUnread
            ? theme.backgroundSelected
            : theme.backgroundElement,
          borderColor: appearance.isUnread ? theme.border : 'transparent',
          opacity: onPress && pressed ? 0.88 : 1,
        },
      ]}>
      <View style={styles.topRow}>
        {appearance.showNewBadge ? (
          <View style={[styles.badge, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={styles.badgeLabel}>
              New
            </ThemedText>
          </View>
        ) : null}
        <View style={[styles.badge, { backgroundColor: chipBackground }]}>
          <ThemedText type="smallBold">{sourceLabel(job.sourceId)}</ThemedText>
        </View>
        {showMatchStatus ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: job.isMatched ? theme.success : chipBackground,
              },
            ]}>
            <ThemedText
              type="smallBold"
              style={job.isMatched ? styles.badgeLabel : undefined}>
              {matchLabel}
            </ThemedText>
          </View>
        ) : null}
        {isFavorite ? (
          <View style={[styles.badge, { backgroundColor: theme.accent }]}>
            <ThemedText type="smallBold" style={styles.badgeLabel}>
              Saved
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.titleRow}>
        {appearance.isUnread ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={[styles.unreadDot, { backgroundColor: theme.text }]}
          />
        ) : null}
        <ThemedText
          style={[
            styles.title,
            {
              fontWeight: appearance.titleWeight,
            },
          ]}>
          {job.title}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary">{job.companyName}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {formatLocation(job.location)} · {workModelLabel(job.workModel)}
      </ThemedText>

      <ThemedText type="small" themeColor="textSecondary">
        Published {formatJobDateLabel(job.publishedAt)} · Found{' '}
        {formatJobDateLabel(job.firstDiscoveredAt)}
      </ThemedText>

      {showDuplicate ? (
        <View style={[styles.duplicate, { borderColor: theme.accent }]}>
          <ThemedText type="smallBold" style={{ color: theme.accent }}>
            Same job detected on {job.duplicateGroupSize} sources
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const unreadElevation = Platform.select<ViewStyle>({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  android: {
    elevation: 2,
  },
  web: {
    boxShadow: '0 1px 4px rgba(15, 18, 24, 0.08)',
  },
  default: {
    elevation: 2,
  },
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    overflow: 'visible',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  badgeLabel: {
    color: '#ffffff',
  },
  title: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
  },
  duplicate: {
    marginTop: Spacing.one,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
});
