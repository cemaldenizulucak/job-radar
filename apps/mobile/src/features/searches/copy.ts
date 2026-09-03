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
  name: 'Arama Adı',
  namePlaceholder: 'Frontend Developer',
  keywords: 'Aranacak Kelimeler',
  keywordsPlaceholder:
    'Frontend Developer, Gıda Mühendisi, Muhasebe Uzmanı, Satış Temsilcisi',
  keywordsHint: 'Birden fazla ifade virgülle ayrılır. Herhangi biri geçerse ilan eşleşir.',
  tags: 'Etiketler',
  tagsPlaceholder: 'React, SAP, ISO 22000',
  tagsHint: 'İsteğe bağlı. Yazılım, gıda, muhasebe veya başka bir alana ait etiketler ekleyebilirsiniz.',
  locations: 'Konum',
  locationsPlaceholder: 'Boş bırakırsanız profil konumunuz kullanılır',
  locationsHint: 'Boş bırakırsanız profil konumunuz kullanılır.',
  profileLocationDefault: (label: string) => `Varsayılan: ${label}`,
  profileLocationBadge: 'Profil konumu',
  experienceLevels: 'Deneyim Seviyesi',
  workTypes: 'Çalışma Şekli',
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
