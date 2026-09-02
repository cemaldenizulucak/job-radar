import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';

import { useJob } from '../hooks/useJobs';
import { JobDetailScreen } from './job-detail-screen';

export function JobDetailRouteScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Array.isArray(id) ? id[0] : id;
  const { user } = useAuth();
  const { job, isLoading, error, refetch, setJob } = useJob(jobId, user?.id);

  if (isLoading) {
    return (
      <ScreenScaffold>
        <ActivityIndicator color={theme.accent} />
      </ScreenScaffold>
    );
  }

  if (error || !job) {
    return (
      <ScreenScaffold>
        <ThemedText style={styles.title}>Job not found</ThemedText>
        <ThemedText themeColor="textSecondary">
          {error ?? 'This listing is not in the current job feed.'}
        </ThemedText>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void refetch();
            }}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 },
            ]}>
            <ThemedText type="smallBold">Retry</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 },
            ]}>
            <ThemedText type="smallBold">Back to jobs</ThemedText>
          </Pressable>
        </View>
      </ScreenScaffold>
    );
  }

  return <JobDetailScreen job={job} onJobChange={setJob} />;
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  backButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
