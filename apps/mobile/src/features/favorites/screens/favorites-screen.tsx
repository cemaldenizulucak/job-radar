import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { JobCard } from '@/features/jobs/components/job-card';

import { favoritesCopy } from '../copy';
import { useFavorites } from '../hooks/useFavorites';

export function FavoritesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { items, isLoading, error, refetch } = useFavorites(user?.id);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const jobs = items.flatMap((item) => (item.job ? [item.job] : []));

  return (
    <ScreenScaffold>
      <ScreenHeader
        title={favoritesCopy.screenTitle}
        subtitle={favoritesCopy.subtitle}
        leading={<BackButton onPress={() => router.back()} />}
      />

      {isLoading ? <LoadingState /> : null}

      {error ? (
        <ErrorState
          title={favoritesCopy.loadError}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isLoading && !error && jobs.length === 0 ? (
        <EmptyState title={favoritesCopy.empty} />
      ) : null}

      {!isLoading && !error && jobs.length > 0 ? (
        <View style={styles.list}>
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isFavorite
              onPress={() => router.push(`/jobs/${job.id}` as Href)}
            />
          ))}
        </View>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
});
