import { type Href, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppBadge } from '@/components/app-badge';
import { AppButton } from '@/components/app-button';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { SectionCard } from '@/components/section-card';
import { ThemedText } from '@/components/themed-text';
import { Borders, Radius, Spacing } from '@/constants/theme';
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
import { jobsCopy, jobsUiError } from '../copy';
import type { JobApplicationStatus, JobDetail } from '../types/job.types';
import { formatTurkishJobDateFromIso } from '../utils/job-dates';
import {
  formatLocation,
  sourceLabel,
  workModelLabel,
} from '../utils/job-labels';
import { getJobSourceAppearance } from '../utils/job-source-appearance';

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
  const publishedLabel =
    formatTurkishJobDateFromIso(job.publishedAt) ?? jobsCopy.dateMissing;
  const discoveredLabel =
    formatTurkishJobDateFromIso(job.firstDiscoveredAt) ?? jobsCopy.dateMissing;
  const sourceAppearance = getJobSourceAppearance(job.sourceId, theme.scheme);

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
      setActionError(jobsUiError(caught, jobsCopy.favoriteError));
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
      setActionError(jobsUiError(caught, jobsCopy.applicationError));
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

      <View
        style={[
          styles.hero,
          {
            backgroundColor: sourceAppearance.badgeBackground,
            borderColor: theme.border,
            borderLeftColor: sourceAppearance.accentColor,
          },
        ]}>
        <View style={styles.heroBadges}>
          <AppBadge
            label={sourceLabel(job.sourceId)}
            backgroundColor={sourceAppearance.badgeBackground}
            textColor={sourceAppearance.badgeTextColor}
          />
          {job.isNew ? (
            <AppBadge
              label={jobsCopy.newBadge}
              backgroundColor={theme.accent}
              textColor={theme.onAccent}
            />
          ) : null}
        </View>
        <ThemedText type="screenTitle">{job.title}</ThemedText>
        <ThemedText type="cardTitle">{job.companyName}</ThemedText>
        <ThemedText type="meta" themeColor="textSecondary">
          {formatLocation(job.location)}
        </ThemedText>
      </View>

      <SectionCard title={jobsCopy.listingInfo}>
        <DetailRow label={jobsCopy.source} value={sourceLabel(job.sourceId)} />
        <DetailRow label={jobsCopy.publishedAt} value={publishedLabel} />
        <DetailRow label={jobsCopy.discoveredAt} value={discoveredLabel} />
        <DetailRow label={jobsCopy.workModel} value={workModelLabel(job.workModel)} />
        <ThemedText type="sectionTitle">{jobsCopy.description}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {job.description?.trim() ? job.description : jobsCopy.descriptionMissing}
        </ThemedText>
      </SectionCard>

      {job.technologies.length > 0 ? (
        <SectionCard title={jobsCopy.technologies}>
          <View style={styles.chipRow}>
            {job.technologies.map((tech) => (
              <AppBadge
                key={tech}
                label={tech}
                backgroundColor={theme.backgroundSelected}
                textColor={theme.text}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {matchedSearches.length > 0 ? (
        <SectionCard title={jobsCopy.matchedSearches}>
          <View style={styles.chipRow}>
            {matchedSearches.map((search) => (
              <AppBadge
                key={search.id}
                label={search.name}
                backgroundColor={theme.accentMuted}
                textColor={theme.accent}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}

      <SectionCard title={jobsCopy.otherSources}>
        {relatedJobs.length === 0 ? (
          <ThemedText type="meta" themeColor="textSecondary">
            {job.duplicateGroupSize > 1
              ? jobsCopy.otherSourcesCount(job.duplicateGroupSize)
              : jobsCopy.otherSourcesEmpty}
          </ThemedText>
        ) : (
          <View style={styles.list}>
            <ThemedText type="meta" themeColor="textSecondary">
              {jobsCopy.otherSourcesCount(job.duplicateGroupSize)}
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
      </SectionCard>

      <SectionCard title={jobsCopy.applicationStatus}>
        <ApplicationStatusPicker
          selectedStatus={job.applicationStatus}
          onSelect={(nextStatus) => {
            void changeStatus(nextStatus);
          }}
        />
      </SectionCard>

      {actionError ? (
        <ThemedText type="meta" style={{ color: theme.danger }}>
          {actionError}
        </ThemedText>
      ) : null}

      <AppButton
        label={jobsCopy.openOriginal}
        disabled={!canOpenOriginal}
        onPress={openOriginal}
        accessibilityLabel={jobsCopy.openOriginal}
        accessibilityRole="link"
      />
    </ScreenScaffold>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="meta" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: Radius.lg,
    borderWidth: Borders.hairline,
    borderLeftWidth: Borders.accent,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  list: {
    gap: Spacing.two,
  },
  detailRow: {
    gap: Spacing.half,
  },
});
