import type { ChipTabItem } from '@/components/chip-tabs';

import type {
  JobApplicationStatus,
  JobListItem,
  JobSourceId,
  WorkModel,
} from '../types/job.types';

export function sourceLabel(sourceId: JobSourceId): string {
  return sourceId === 'linkedin' ? 'LinkedIn' : 'Kariyer.net';
}

export function workModelLabel(workModel: WorkModel | null): string {
  if (workModel === 'remote') {
    return 'Remote';
  }

  if (workModel === 'hybrid') {
    return 'Hybrid';
  }

  if (workModel === 'onsite') {
    return 'On-site';
  }

  return 'Work model unknown';
}

export function isSourceFilter(id: string): id is JobSourceId | 'all' {
  return id === 'all' || id === 'linkedin' || id === 'kariyer_net';
}

export function formatJobDateLabel(iso: string | null): string {
  if (!iso) {
    return 'Unknown';
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatLocation(location: string | null): string {
  const trimmed = location?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'Location unknown';
}

export function latestFirstDiscoveredAt(
  items: readonly JobListItem[],
): string | null {
  const first = items[0];
  if (!first) {
    return null;
  }

  return items.reduce((latest, item) => {
    return item.firstDiscoveredAt > latest ? item.firstDiscoveredAt : latest;
  }, first.firstDiscoveredAt);
}

export function countJobsBySource(
  items: readonly JobListItem[],
  sourceId: JobSourceId | 'all',
): number {
  if (sourceId === 'all') {
    return items.length;
  }

  return items.filter((item) => item.sourceId === sourceId).length;
}

export function buildSourceTabs(items: readonly JobListItem[]): ChipTabItem[] {
  return [
    { id: 'all', label: 'All', count: countJobsBySource(items, 'all') },
    { id: 'linkedin', label: 'LinkedIn', count: countJobsBySource(items, 'linkedin') },
    {
      id: 'kariyer_net',
      label: 'Kariyer.net',
      count: countJobsBySource(items, 'kariyer_net'),
    },
  ];
}

export function filterJobs(
  jobs: readonly JobListItem[],
  sourceId: JobSourceId | 'all',
  savedSearchId: string | 'all',
): JobListItem[] {
  return jobs.filter((job) => {
    const matchesSource = sourceId === 'all' || job.sourceId === sourceId;
    const matchesSearch =
      savedSearchId === 'all' || job.matchedSearchIds.includes(savedSearchId);
    return matchesSource && matchesSearch;
  });
}

export const JOB_APPLICATION_STATUSES: readonly JobApplicationStatus[] = [
  'NEW',
  'REVIEWING',
  'APPLIED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
];

export function applicationStatusLabel(status: JobApplicationStatus): string {
  switch (status) {
    case 'NEW':
      return 'New';
    case 'REVIEWING':
      return 'Reviewing';
    case 'APPLIED':
      return 'Applied';
    case 'INTERVIEW':
      return 'Interview';
    case 'OFFER':
      return 'Offer';
    case 'REJECTED':
      return 'Rejected';
  }
}
