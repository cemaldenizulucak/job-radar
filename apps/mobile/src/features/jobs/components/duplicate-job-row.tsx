import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { pressOpacity } from '@/constants/ui';
import { useTheme } from '@/hooks/use-theme';

import { jobsCopy } from '../copy';
import type { DuplicateJobLink } from '../types/job.types';
import { sourceLabel } from '../utils/job-labels';

type DuplicateJobRowProps = {
  job: DuplicateJobLink;
  onPress: () => void;
};

export function DuplicateJobRow({ job, onPress }: DuplicateJobRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sourceLabel(job.sourceId)}, ${job.title}, ${jobsCopy.viewListing}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.backgroundElement,
          opacity: pressOpacity(pressed),
        },
      ]}>
      <View style={styles.copy}>
        <ThemedText type="smallBold">{sourceLabel(job.sourceId)}</ThemedText>
        <ThemedText>{job.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {job.companyName}
        </ThemedText>
      </View>
      <ThemedText type="small" style={{ color: theme.accent }}>
        {jobsCopy.viewListing}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: Radius.md,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  copy: {
    flex: 1,
    gap: Spacing.half,
  },
});
