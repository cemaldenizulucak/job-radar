export type SourceId = 'linkedin' | 'kariyer_net';

export type WorkModel = 'remote' | 'hybrid' | 'onsite' | 'unknown';

export const APPLICATION_STATUSES = [
  'NEW',
  'REVIEWING',
  'APPLIED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}
