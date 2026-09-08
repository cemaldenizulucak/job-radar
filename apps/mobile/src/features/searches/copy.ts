export const searchesCopy = {
  tabTitle: 'Aramalar',
  screenTitle: 'Aramalar',
  subtitle: 'Kayıtlı aramalar hesabınıza aittir. Tarama arka planda devam eder.',
  newSearch: 'Yeni Arama',
  createTitle: 'Yeni Arama',
  createSubtitle: 'Aktif bir aramayı kaydettiğiniz anda LinkedIn ve Kariyer.net taranır.',
  editTitle: 'Aramayı Düzenle',
  editSubtitle: 'Filtreleri değiştirmek bu arama için LinkedIn ve Kariyer.net sonuçlarını yeniler.',
  saveSearch: 'Aramayı Kaydet',
  saveChanges: 'Aramayı Kaydet',
  scanning: 'LinkedIn ve Kariyer.net taranıyor...',
  scanningHint: 'Bu işlem biraz sürebilir. Uygulamayı kapatmayın.',
  refreshing: 'Sonuçlar yenileniyor...',
  sectionBasics: 'Temel Bilgiler',
  sectionAdvanced: 'Ek Filtreler',
  name: 'Arama adı',
  namePlaceholder: 'Frontend Developer',
  keywords: 'Pozisyon / anahtar kelime',
  keywordsPlaceholder: 'Frontend Developer',
  keywordsHint: 'Birden fazla ifade virgülle ayrılır. Herhangi biri geçerse ilan eşleşir.',
  tags: 'Teknoloji',
  tagsPlaceholder: 'React, TypeScript',
  tagsHint: 'İsteğe bağlı. Boş bırakırsanız teknoloji yüzünden ilan elenmez.',
  locations: 'Konum',
  country: 'Ülke',
  countryPlaceholder: 'Ülke seç',
  countryHint: 'Boş bırakırsanız tüm ülkeler kabul edilir.',
  subdivision: 'İl / Bölge',
  subdivisionPlaceholder: 'İl / Bölge seç',
  subdivisionHint: 'Birden fazla il seçebilirsiniz. Tümü, ülke içindeki bütün konumları kabul eder.',
  locationAll: 'Tümü',
  applyPicker: 'Uygula',
  locationLoading: 'Yükleniyor...',
  locationListError: 'Konum listesi yüklenemedi',
  locationRetry: 'Tekrar dene',
  locationEmptyFilter: 'Eşleşen konum yok.',
  searchLocation: 'Ara',
  closePicker: 'Kapat',
  locationsPlaceholder: 'İsteğe bağlı',
  locationsHint: 'Konum seçmek zorunda değilsiniz.',
  profileLocationDefault: (label: string) => `Varsayılan: ${label}`,
  profileLocationBadge: 'Profil konumu',
  experienceLevels: 'Deneyim',
  experiencePlaceholder: 'İsteğe bağlı',
  workTypes: 'Çalışma Şekli',
  workTypesHint:
    'Boş bırakırsanız çalışma şekli yüzünden ilan elenmez. Uzaktan ve hibrit ayrı tutulur; başka şehirdeki hibrit ilan uzaktan sayılmaz.',
  sources: 'Kaynaklar',
  active: 'Aktif',
  paused: 'Duraklatıldı',
  activeHint: 'Pasif aramalar taramalara dahil edilmez.',
  includedInScans: 'Zamanlanmış taramalara dahil.',
  pausedHint: 'Duraklatıldı. Gelecek taramalar durur. İlanlar silinmez.',
  remote: 'Uzaktan',
  hybrid: 'Hibrit',
  onsite: 'Ofiste',
  any: 'Fark etmez',
  noSources: 'Kaynak seçilmedi',
  noKeywords: 'Anahtar kelime yok',
  selectedSource: 'Seçildi',
  unselectedSource: 'Seçilmedi',
  matchCount: (count: number) => `${count} sonuç`,
  viewJobs: 'İlanları Gör',
  empty: 'LinkedIn ve Kariyer.net ilanlarını toplamak için bir arama oluşturun.',
  loadError: 'Aramalar yüklenemedi.',
  notFound: 'Arama bulunamadı.',
  notAvailable: 'Bu arama kullanılamıyor.',
  createError: 'Arama oluşturulamadı.',
  updateError: 'Arama güncellenemedi.',
  deleteError: 'Arama silinemedi.',
  nameRequired: 'Arama adı gerekli.',
  keywordRequired: 'En az bir aranacak kelime ekleyin.',
  sourceRequired: 'En az bir kaynak seçin.',
  savedAlertTitle: 'Arama kaydedildi',
} as const;

export function workTypeLabel(value: string): string {
  if (value === 'remote') {
    return searchesCopy.remote;
  }

  if (value === 'hybrid') {
    return searchesCopy.hybrid;
  }

  if (value === 'onsite') {
    return searchesCopy.onsite;
  }

  return value;
}

export function sourceName(source: string): string {
  return source === 'linkedin' ? 'LinkedIn' : 'Kariyer.net';
}
