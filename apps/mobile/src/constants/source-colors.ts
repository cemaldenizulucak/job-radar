export type SourceColorScheme = 'light' | 'dark';

export type SourceAppearanceTokens = {
  accentColor: string;
  badgeBackground: string;
  badgeTextColor: string;
};

export const SourceColors: Record<
  SourceColorScheme,
  {
    linkedin: SourceAppearanceTokens;
    kariyer_net: SourceAppearanceTokens;
    fallback: SourceAppearanceTokens;
  }
> = {
  light: {
    linkedin: {
      accentColor: '#0A66C2',
      badgeBackground: '#E7F0F9',
      badgeTextColor: '#0A66C2',
    },
    kariyer_net: {
      accentColor: '#7C3AED',
      badgeBackground: '#F3EBFE',
      badgeTextColor: '#6D28D9',
    },
    fallback: {
      accentColor: '#2563EB',
      badgeBackground: '#DBEAFE',
      badgeTextColor: '#1D4ED8',
    },
  },
  dark: {
    linkedin: {
      accentColor: '#0A66C2',
      badgeBackground: '#152A42',
      badgeTextColor: '#8BBDE8',
    },
    kariyer_net: {
      accentColor: '#7C3AED',
      badgeBackground: '#2A1B4A',
      badgeTextColor: '#C4B5FD',
    },
    fallback: {
      accentColor: '#3B82F6',
      badgeBackground: '#1E3A5F',
      badgeTextColor: '#93C5FD',
    },
  },
};
