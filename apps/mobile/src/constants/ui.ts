export const uiCopy = {
  retry: 'Tekrar Dene',
  cancel: 'İptal',
  save: 'Kaydet',
  delete: 'Sil',
  edit: 'Düzenle',
  back: 'Geri',
  loading: 'Yükleniyor...',
  all: 'Tümü',
  errorHint: 'Bağlantınızı kontrol edip tekrar deneyin.',
  genericError: 'Bir sorun oluştu. Lütfen tekrar deneyin.',
  sessionExpired: 'Oturumunuz sona erdi. Lütfen tekrar giriş yapın.',
  signedInRequired: 'Oturum açmanız gerekiyor.',
} as const;

export function uiError(error: unknown, fallback: string): string {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
  }

  return fallback;
}

export function pressOpacity(pressed: boolean, disabled = false): number {
  if (disabled) {
    return 0.55;
  }

  return pressed ? 0.88 : 1;
}
