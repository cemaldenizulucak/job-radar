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
import { useFavoriteToggle } from '@/features/favorites/hooks/useFavoriteToggle';
import { useSavedSearches } from '@/features/searches/hooks/useSavedSearches';
import { useTheme } from '@/hooks/use-theme';

import { ApplicationStatusPicker } from '../components/application-status-picker';
import { DuplicateJobRow } from '../components/duplicate-job-row';
import { JobDetailHeader } from '../components/job-detail-header';
import { jobsCopy, jobsUiError, matchKindLabel, isUnverifiedSourceMatch } from '../copy';
import type { JobApplicationStatus, JobDetail, MatchedSearch } from '../types/job.types';
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
  const {
    isFavorite,
    error: favoriteError,
    toggleFavorite: persistFavorite,
  } = useFavoriteToggle();
  const favorite = isFavorite(job.id, job.isFavorite);
  const matchedSearches = useMemo(() => {
    const names = new Map(searches.map((search) => [search.id, search.name]));
    const raw =
      job.matchedSearches.length > 0
        ? job.matchedSearches
        : job.matchedSearchIds.map((id) => ({
          id,
          name: id,
          matchKind: null,
          terms: [],
          evidence: [],
        }));

    return raw.map((search) => ({
      ...search,
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
    if (!user) {
      return;
    }

    setActionError(null);
    const result = await persistFavorite(job.id, favorite);
    if (result === 'ok') {
      onJobChange({ ...job, isFavorite: !favorite });
    }
    if (result === 'error') {
      onJobChange({ ...job, isFavorite: favorite });
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
      isFavorite: favorite,
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
          isFavorite: favorite,
          applicationStatus: null,
          applicationId: null,
        });
        return;
      }

      const saved = await upsertApplication(job.id, status);
      onJobChange({
        ...job,
        isFavorite: favorite,
        applicationStatus: saved.status,
        applicationId: saved.id,
      });
    } catch (caught) {
      onJobChange({
        ...job,
        isFavorite: favorite,
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
        isFavorite={favorite}
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
        <ThemedText type="screenTitle" numberOfLines={3} ellipsizeMode="tail">
          {job.title}
        </ThemedText>
        <ThemedText type="smallBold" numberOfLines={2} ellipsizeMode="tail">
          {job.companyName}
        </ThemedText>
        <ThemedText type="meta" themeColor="textSecondary" numberOfLines={2}>
          {[formatLocation(job.location), workModelLabel(job.workModel)]
            .filter((part): part is string => Boolean(part))
            .join(' · ')}
        </ThemedText>
      </View>

      <SectionCard title={jobsCopy.listingInfo}>
        <DetailRow label={jobsCopy.source} value={sourceLabel(job.sourceId)} />
        <DetailRow label={jobsCopy.publishedAt} value={publishedLabel} />
        <DetailRow label={jobsCopy.discoveredAt} value={discoveredLabel} />
        <DetailRow
          label={jobsCopy.workModel}
          value={workModelLabel(job.workModel) ?? jobsCopy.workModelUnknown}
        />
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
          <View style={styles.list}>
            {matchedSearches.map((search) => (
              <MatchedSearchBlock key={search.id} search={search} />
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

      {actionError || favoriteError ? (
        <ThemedText type="meta" style={{ color: theme.danger }}>
          {actionError ?? favoriteError}
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

function MatchedSearchBlock({ search }: { search: MatchedSearch }) {
  const unverified = isUnverifiedSourceMatch(search.matchStatus);
  const kind = unverified ? jobsCopy.possibleMatchBadge : matchKindLabel(search.matchKind);
  const terms = unverified
    ? null
    : search.terms.length > 0
      ? search.terms.join(', ')
      : null;
  const snippets = unverified
    ? []
    : search.evidence
        .map((item) => item.snippet ?? item.matchedText)
        .filter((value) => value.trim().length > 0);

  return (
    <View style={styles.matchBlock}>
      <DetailRow label={jobsCopy.matchedSearchLabel} value={search.name} />
      {kind ? <DetailRow label={jobsCopy.matchKindLabel} value={kind} /> : null}
      {unverified ? (
        <ThemedText type="meta" themeColor="textSecondary">
          {jobsCopy.possibleMatchHint}
        </ThemedText>
      ) : null}
      {!unverified && search.evidence.some((item) => item.basis === 'education_field') ? (
        <DetailRow
          label={jobsCopy.matchBasisLabel}
          value={jobsCopy.matchBasisEducation}
        />
      ) : null}
      {terms ? (
        <DetailRow label={jobsCopy.matchedTermsLabel} value={terms} />
      ) : null}
      {snippets.length > 0 ? (
        <View style={styles.detailRow}>
          <ThemedText type="meta" themeColor="textSecondary">
            {jobsCopy.matchEvidenceLabel}
          </ThemedText>
          {snippets.map((snippet) => (
            <ThemedText key={snippet} themeColor="textSecondary">
              {snippet}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </View>
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
  matchBlock: {
    gap: Spacing.one,
  },
});
