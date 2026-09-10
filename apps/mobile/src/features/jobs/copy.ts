export const jobsCopy = {
  tabTitle: 'İlanlar',
  screenTitle: 'İş İlanları',
  results: 'Sonuçlar',
  source: 'Kaynak',
  savedSearches: 'Kayıtlı arama',
  savedSearchSelector: 'Kayıtlı arama',
  matched: 'Eşleşen',
  matchedListings: 'Eşleşen İlanlar',
  possibleShort: 'Olası',
  possibleMatches: 'Olası Eşleşmeler',
  allResults: 'Tüm sonuçlar',
  all: 'Tümü',
  summaryTotal: 'Toplam',
  resultCount: (count: number) => `${count} ilan`,
  clearFilters: 'Filtreleri temizle',
  possibleMatchesExplainer:
    'Bu ilanların açıklaması henüz doğrulanamadı.',
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
  emptyVerified: 'Henüz doğrulanmış bir eşleşme bulunamadı.',
  emptyPossible: 'Şu anda doğrulanmayı bekleyen ilan bulunmuyor.',
  emptyAll: 'Henüz ilan bulunamadı.',
  emptyFilter: 'Seçili filtrelerle eşleşen ilan yok.',
  emptyFilterHint: 'Kaynak veya kayıtlı arama filtresini temizleyip tekrar deneyin.',
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
    'İlan arama kriterinizle bulundu ancak ilan açıklaması doğrulanamadı.',
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

export function matchResultsTabLabel(
  view: 'matched' | 'possible' | 'all',
  count: number | null,
): string {
  const base =
    view === 'matched'
      ? jobsCopy.matched
      : view === 'possible'
        ? jobsCopy.possibleShort
        : jobsCopy.allResults;
  return count === null ? base : `${base} (${count})`;
}

export function sourceFilterLabel(
  sourceId: 'all' | 'linkedin' | 'kariyer_net',
  count: number | null,
): string {
  const base =
    sourceId === 'all'
      ? jobsCopy.all
      : sourceId === 'linkedin'
        ? 'LinkedIn'
        : 'Kariyer.net';
  return count === null ? base : `${base} (${count})`;
}

export function jobsEmptyMessage(input: {
  itemCount: number;
  visibleCount: number;
  resultsView: 'matched' | 'possible' | 'all';
  isDiscovering?: boolean;
  isLoading?: boolean;
  hasError?: boolean;
  hasActiveFilters?: boolean;
}): string | null {
  if (input.isDiscovering || input.isLoading || input.hasError) {
    return null;
  }

  if (input.visibleCount > 0) {
    return null;
  }

  if (input.hasActiveFilters) {
    return jobsCopy.emptyFilter;
  }

  if (input.itemCount === 0) {
    if (input.resultsView === 'all') {
      return jobsCopy.emptyAll;
    }
    if (input.resultsView === 'possible') {
      return jobsCopy.emptyPossible;
    }
    return jobsCopy.emptyVerified;
  }

  return jobsCopy.emptyFilter;
}
