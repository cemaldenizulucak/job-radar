import { type Href, useRouter } from 'expo-router';

import { AppBadge } from '@/components/app-badge';
import { AppCard } from '@/components/app-card';
import { ThemedText } from '@/components/themed-text';
import { sourceLabel } from '@/features/jobs/utils/job-labels';
import { useTheme } from '@/hooks/use-theme';

import { applicationsCopy } from '../copy';
import type { ApplicationItem } from '../services/applications.service';
import { APPLICATION_SECTION_LABELS } from '../types/application.types';
import { getApplicationStatusAppearance } from '../utils/status-appearance';

type ApplicationRowProps = {
  application: ApplicationItem;
};

export function ApplicationRow({ application }: ApplicationRowProps) {
  const theme = useTheme();
  const router = useRouter();
  const appearance = getApplicationStatusAppearance(application.status, theme.scheme);

  return (
    <AppCard
      onPress={() => router.push(`/jobs/${application.jobId}` as Href)}
      accessibilityLabel={`${application.title || applicationsCopy.untitledJob}, ${APPLICATION_SECTION_LABELS[application.status]}`}>
      <ThemedText type="cardTitle">
        {application.title || applicationsCopy.untitledJob}
      </ThemedText>
      <ThemedText type="meta" themeColor="textSecondary">
        {application.companyName || applicationsCopy.unknownCompany} ·{' '}
        {sourceLabel(application.sourceId)}
      </ThemedText>
      <AppBadge
        label={APPLICATION_SECTION_LABELS[application.status]}
        backgroundColor={appearance.backgroundColor}
        textColor={appearance.textColor}
      />
    </AppCard>
  );
}
