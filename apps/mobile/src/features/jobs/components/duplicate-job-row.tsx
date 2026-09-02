import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.backgroundElement,
          opacity: pressed ? 0.88 : 1,
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
        View
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 14,
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
