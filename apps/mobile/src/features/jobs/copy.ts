export const jobsCopy = {
  tabTitle: 'İlanlar',
  screenTitle: 'İş İlanları',
  results: 'Sonuçlar',
  source: 'Kaynak',
  savedSearches: 'Kayıtlı aramalar',
  matched: 'Eşleşenler',
  allResults: 'Tüm sonuçlar',
  all: 'Tümü',
  summaryTotal: 'Toplam',
  newBadge: 'Yeni',
  unreadA11y: 'Okunmadı',
  favorite: 'Favori',
  favoriteAdd: 'Favorilere Ekle',
  favoriteRemove: 'Favorilerden Çıkar',
  matchedShort: 'Eşleşti',
  notMatched: 'Eşleşmedi',
  loadingFeed: 'İlanlar yükleniyor...',
  searchingFeed: 'İlanlar aranıyor...',
  searchingFeedHint: 'Yeni aramanız için ilanlar taranıyor.',
  feedError: 'İlanlar yüklenemedi.',
  retry: 'Tekrar Dene',
  signedInRequired: 'Oturum açmanız gerekiyor.',
  jobsLoaded: 'İlanlar yüklendi',
  lastScan: 'Son tarama',
  emptyMatched: 'Bu aramaya uygun ilan bulunamadı.',
  emptyAll: 'Henüz ilan bulunamadı.',
  emptyFilter: 'Bu filtre için henüz eşleşen ilan yok.',
  locationUnknown: 'Konum belirtilmedi',
  workModelRemote: 'Uzaktan',
  workModelHybrid: 'Hibrit',
  workModelOnsite: 'Ofiste',
  workModelUnknown: 'Çalışma modeli belirtilmedi',
  dateMissing: 'Belirtilmedi',
  listing: 'İlan',
  listingInfo: 'İlan Bilgileri',
  company: 'Şirket',
  location: 'Konum',
  workModel: 'Çalışma Modeli',
  publishedAt: 'Yayın Tarihi',
  discoveredAt: 'Bulunma Tarihi',
  technologies: 'Teknolojiler',
  description: 'Açıklama',
  descriptionMissing: 'Açıklama yok.',
  matchedSearches: 'Eşleşen Aramalar',
  otherSources: 'Diğer kaynaklar',
  otherSourcesEmpty: 'Başka kaynakta aynı ilan bulunamadı.',
  otherSourcesCount: (count: number) =>
    `Aynı ilan ${count} kaynakta tespit edildi. Her ilan ayrı tutulur.`,
  applicationStatus: 'Başvuru Durumu',
  notTracking: 'Takip edilmiyor',
  openOriginal: 'Orijinal İlana Git',
  back: 'Geri',
  backToJobs: 'İlanlara dön',
  jobNotFound: 'İlan bulunamadı.',
  jobNotInFeed: 'Bu ilan mevcut listede yok.',
  loadingJob: 'İlan yükleniyor...',
  favoriteError: 'Favori güncellenemedi.',
  applicationError: 'Başvuru durumu güncellenemedi.',
  notifications: 'Bildirimler',
  notificationsUnread: (count: number) => `Bildirimler, ${count} okunmamış`,
  favorites: 'Favoriler',
  viewListing: 'Görüntüle',
  applicationNew: 'Yeni',
  applicationReviewing: 'İnceleniyor',
  applicationApplied: 'Başvuruldu',
  applicationInterview: 'Mülakat',
  applicationOffer: 'Teklif',
  applicationRejected: 'Reddedildi',
  matchedSearchLabel: 'Eşleşen arama',
  matchKindLabel: 'Eşleşme türü',
  matchKindDirect: 'Doğrudan eşleşme',
  matchKindSkill: 'Beceri eşleşmesi',
  matchBasisLabel: 'Neden',
  matchBasisEducation: 'Eğitim alanı eşdeğerliği',
  matchedTermsLabel: 'Eşleşen terimler',
  matchEvidenceLabel: 'Kanıt',
  possibleMatchBadge: 'Olası eşleşme',
  possibleMatchHint:
    'İlan Kariyer.net’te arama kriterinizle bulundu ancak açıklama doğrulanamadı.',
} as const;

export function isUnverifiedSourceMatch(
  status: string | null | undefined,
): boolean {
  return status === 'unverified_source_candidate';
}

export function matchKindLabel(
  kind: 'direct' | 'skill' | null | undefined,
): string | null {
  if (kind === 'direct') {
    return jobsCopy.matchKindDirect;
  }

  if (kind === 'skill') {
    return jobsCopy.matchKindSkill;
  }

  return null;
}

export function jobsUiError(error: unknown, fallback: string): string {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return error instanceof Error && error.message.trim().length > 0
      ? error.message
      : fallback;
  }

  return fallback;
}

export function jobsEmptyMessage(input: {
  itemCount: number;
  visibleCount: number;
  resultsView: 'matched' | 'all';
  isDiscovering?: boolean;
}): string | null {
  if (input.isDiscovering) {
    return null;
  }

  if (input.visibleCount > 0) {
    return null;
  }

  if (input.itemCount === 0) {
    return input.resultsView === 'all' ? jobsCopy.emptyAll : jobsCopy.emptyMatched;
  }

  return jobsCopy.emptyFilter;
}
