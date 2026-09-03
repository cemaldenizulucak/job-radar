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
  NEW: 'Yeni',
  REVIEWING: 'İnceleniyor',
  APPLIED: 'Başvuruldu',
  INTERVIEW: 'Mülakat',
  OFFER: 'Teklif',
  REJECTED: 'Reddedildi',
};
