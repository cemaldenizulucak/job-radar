import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { sourceLabel } from '@/features/jobs/utils/job-labels';
import { useTheme } from '@/hooks/use-theme';

import type { ApplicationItem } from '../services/applications.service';
import { APPLICATION_SECTION_LABELS } from '../types/application.types';

type ApplicationRowProps = {
  application: ApplicationItem;
};

export function ApplicationRow({ application }: ApplicationRowProps) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/jobs/${application.jobId}` as Href)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.88 : 1 },
      ]}>
      <View style={styles.copy}>
        <ThemedText type="smallBold">
          {application.title || 'Untitled job'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {application.companyName || 'Unknown company'} ·{' '}
          {sourceLabel(application.sourceId)}
        </ThemedText>
      </View>
      <ThemedText type="smallBold">{APPLICATION_SECTION_LABELS[application.status]}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderRadius: 12,
    padding: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  copy: {
    flex: 1,
    gap: Spacing.half,
  },
});
