import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { JobCard } from '@/features/jobs/components/job-card';
import { useTheme } from '@/hooks/use-theme';

import { useFavorites } from '../hooks/useFavorites';

export function FavoritesScreen() {
  const theme = useTheme();
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
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.back,
            { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.85 : 1 },
          ]}>
          <ThemedText type="smallBold">Back</ThemedText>
        </Pressable>
        <ThemedText style={styles.title}>Favorites</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Saved listings stay available even when a search is paused.
        </ThemedText>
      </View>

      {isLoading ? <ActivityIndicator color={theme.accent} /> : null}

      {error ? (
        <View style={styles.state}>
          <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              void refetch();
            }}
            style={[styles.retry, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">Retry</ThemedText>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !error && jobs.length === 0 ? (
        <ThemedText themeColor="textSecondary">
          Save a job from its detail screen to see it here.
        </ThemedText>
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
  header: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  back: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  list: {
    gap: Spacing.three,
  },
  state: {
    gap: Spacing.two,
  },
  retry: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
