export type ApplicationStatus =
  | 'NEW'
  | 'REVIEWING'
  | 'APPLIED'
  | 'INTERVIEW'
  | 'OFFER'
  | 'REJECTED';

export const APPLICATION_SECTIONS: readonly ApplicationStatus[] = [
  'NEW',
  'REVIEWING',
  'APPLIED',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
];

export const APPLICATION_SECTION_LABELS: Record<ApplicationStatus, string> = {
  NEW: 'New',
  REVIEWING: 'Reviewing',
  APPLIED: 'Applied',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
};
