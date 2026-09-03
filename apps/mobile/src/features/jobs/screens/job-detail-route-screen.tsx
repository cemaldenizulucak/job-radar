import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';

import { jobsCopy } from '../copy';
import { useJob } from '../hooks/useJobs';
import { JobDetailScreen } from './job-detail-screen';

export function JobDetailRouteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobId = Array.isArray(id) ? id[0] : id;
  const { user } = useAuth();
  const { job, isLoading, error, refetch, setJob } = useJob(jobId, user?.id);

  if (isLoading) {
    return (
      <ScreenScaffold>
        <LoadingState message={jobsCopy.loadingJob} />
      </ScreenScaffold>
    );
  }

  if (error || !job) {
    return (
      <ScreenScaffold>
        <ThemedText type="screenTitle">{jobsCopy.jobNotFound}</ThemedText>
        <ErrorState
          title={jobsCopy.jobNotFound}
          message={
            typeof __DEV__ !== 'undefined' && __DEV__ && error
              ? error
              : jobsCopy.jobNotInFeed
          }
          onRetry={() => {
            void refetch();
          }}
        />
        <View style={styles.actions}>
          <AppButton
            label={jobsCopy.backToJobs}
            variant="ghost"
            onPress={() => router.back()}
          />
        </View>
      </ScreenScaffold>
    );
  }

  return <JobDetailScreen job={job} onJobChange={setJob} />;
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
