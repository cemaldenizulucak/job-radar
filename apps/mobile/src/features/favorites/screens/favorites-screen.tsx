import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { BackButton } from '@/components/back-button';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingState } from '@/components/loading-state';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { JobCard } from '@/features/jobs/components/job-card';
import { useTheme } from '@/hooks/use-theme';

import { favoritesCopy } from '../copy';
import { useFavoriteToggle } from '../hooks/useFavoriteToggle';
import { useFavorites } from '../hooks/useFavorites';

export function FavoritesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { items, isLoading, error, refetch } = useFavorites(user?.id);
  const { isFavorite, error: favoriteError, toggleFavorite } = useFavoriteToggle();

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const jobs = items.flatMap((item) => (item.job ? [item.job] : []));
  const visibleJobs = jobs.filter((job) => isFavorite(job.id, true));

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

      {favoriteError ? (
        <ThemedText type="meta" style={{ color: theme.danger }}>
          {favoriteError}
        </ThemedText>
      ) : null}

      {!isLoading && !error && visibleJobs.length === 0 ? (
        <EmptyState
          title={favoritesCopy.empty}
          message={favoritesCopy.subtitle}
          icon={
            <SymbolView
              name={{ ios: 'heart', android: 'favorite_border', web: 'favorite_border' }}
              size={36}
              tintColor={theme.textSecondary}
            />
          }
        />
      ) : null}

      {!isLoading && !error && visibleJobs.length > 0 ? (
        <View style={styles.list}>
          {visibleJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              isFavorite={isFavorite(job.id, true)}
              onToggleFavorite={() => {
                void toggleFavorite(job.id, isFavorite(job.id, true));
              }}
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
