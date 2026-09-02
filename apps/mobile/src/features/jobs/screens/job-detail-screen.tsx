import { type Href, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  deleteApplication,
  upsertApplication,
} from '@/features/applications/services/applications.service';
import {
  addFavorite,
  removeFavorite,
} from '@/features/favorites/services/favorites.service';
import { useSavedSearches } from '@/features/searches/hooks/useSavedSearches';
import { useTheme } from '@/hooks/use-theme';

import { ApplicationStatusPicker } from '../components/application-status-picker';
import { DuplicateJobRow } from '../components/duplicate-job-row';
import { JobDetailHeader } from '../components/job-detail-header';
import type { JobApplicationStatus, JobDetail } from '../types/job.types';
import {
  formatJobDateLabel,
  formatLocation,
  sourceLabel,
  workModelLabel,
} from '../utils/job-labels';

type JobDetailScreenProps = {
  job: JobDetail;
  onJobChange: (job: JobDetail) => void;
};

function jobDetailHref(jobId: string): Href {
  return `/jobs/${jobId}` as Href;
}

export function JobDetailScreen({ job, onJobChange }: JobDetailScreenProps) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const relatedJobs = job.duplicateJobs;
  const { items: searches } = useSavedSearches();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const matchedSearches = useMemo(() => {
    const names = new Map(searches.map((search) => [search.id, search.name]));
    const raw =
      job.matchedSearches.length > 0
        ? job.matchedSearches
        : job.matchedSearchIds.map((id) => ({ id, name: id }));

    return raw.map((search) => ({
      id: search.id,
      name: names.get(search.id) ?? search.name,
    }));
  }, [job.matchedSearchIds, job.matchedSearches, searches]);
  const canOpenOriginal = job.canonicalUrl.trim().length > 0;

  const openOriginal = () => {
    if (!canOpenOriginal) {
      return;
    }

    void WebBrowser.openBrowserAsync(job.canonicalUrl);
  };

  const toggleFavorite = async () => {
    if (!user || isBusy) {
      return;
    }

    setActionError(null);
    setIsBusy(true);
    const nextFavorite = !job.isFavorite;
    onJobChange({ ...job, isFavorite: nextFavorite });

    try {
      if (nextFavorite) {
        await addFavorite(job.id);
      } else {
        await removeFavorite(job.id);
      }
    } catch (caught) {
      onJobChange({ ...job, isFavorite: job.isFavorite });
      setActionError(
        caught instanceof Error ? caught.message : 'Couldn’t save favorite.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  const changeStatus = async (status: JobApplicationStatus | null) => {
    if (!user || isBusy) {
      return;
    }

    setActionError(null);
    setIsBusy(true);
    const previous = {
      applicationStatus: job.applicationStatus,
      applicationId: job.applicationId,
    };
    onJobChange({
      ...job,
      applicationStatus: status,
      applicationId: status ? job.applicationId : null,
    });

    try {
      if (!status) {
        if (job.applicationId) {
          await deleteApplication(job.applicationId);
        }
        onJobChange({
          ...job,
          applicationStatus: null,
          applicationId: null,
        });
        return;
      }

      const saved = await upsertApplication(job.id, status);
      onJobChange({
        ...job,
        applicationStatus: saved.status,
        applicationId: saved.id,
      });
    } catch (caught) {
      onJobChange({
        ...job,
        applicationStatus: previous.applicationStatus,
        applicationId: previous.applicationId,
      });
      setActionError(
        caught instanceof Error ? caught.message : 'Couldn’t update application status.',
      );
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <ScreenScaffold>
      <JobDetailHeader
        onBack={() => router.back()}
        isFavorite={job.isFavorite}
        onToggleFavorite={() => {
          void toggleFavorite();
        }}
      />

      <View style={styles.hero}>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{sourceLabel(job.sourceId)}</ThemedText>
          </View>
        </View>
        <ThemedText style={styles.title}>{job.title}</ThemedText>
        <ThemedText>{job.companyName}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatLocation(job.location)} · {workModelLabel(job.workModel)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Published {formatJobDateLabel(job.publishedAt)} · Found{' '}
          {formatJobDateLabel(job.firstDiscoveredAt)}
        </ThemedText>
      </View>

      {job.technologies.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Technologies
          </ThemedText>
          <View style={styles.techRow}>
            {job.technologies.map((tech) => (
              <View
                key={tech}
                style={[styles.techChip, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small">{tech}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Description
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {job.description?.trim() ? job.description : 'No description provided.'}
        </ThemedText>
      </View>

      {matchedSearches.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Matching saved searches
          </ThemedText>
          <View style={styles.techRow}>
            {matchedSearches.map((search) => (
              <View
                key={search.id}
                style={[styles.techChip, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">{search.name}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Related on other sources
        </ThemedText>
        {relatedJobs.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            {job.duplicateGroupSize > 1
              ? `Same job detected on ${job.duplicateGroupSize} sources. Each listing stays separate.`
              : 'No duplicate listings detected. This source-specific post stays on its own.'}
          </ThemedText>
        ) : (
          <View style={styles.list}>
            <ThemedText type="small" themeColor="textSecondary">
              Same job detected on {job.duplicateGroupSize} sources. Each listing stays
              separate.
            </ThemedText>
            {relatedJobs.map((related) => (
              <DuplicateJobRow
                key={related.id}
                job={related}
                onPress={() => router.push(jobDetailHref(related.id))}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Application status
        </ThemedText>
        <ApplicationStatusPicker
          selectedStatus={job.applicationStatus}
          onSelect={(nextStatus) => {
            void changeStatus(nextStatus);
          }}
        />
      </View>

      {actionError ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {actionError}
        </ThemedText>
      ) : null}

      <Pressable
        accessibilityRole="link"
        disabled={!canOpenOriginal}
        onPress={openOriginal}
        style={({ pressed }) => [
          styles.primaryButton,
          {
            backgroundColor: theme.accent,
            opacity: !canOpenOriginal ? 0.5 : pressed ? 0.88 : 1,
          },
        ]}>
        <ThemedText type="smallBold" style={styles.primaryLabel}>
          Open original job
        </ThemedText>
      </Pressable>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.two,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  section: {
    gap: Spacing.two,
  },
  techRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  techChip: {
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  list: {
    gap: Spacing.two,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  primaryLabel: {
    color: '#ffffff',
    fontSize: 16,
  },
});
