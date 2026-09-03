import '@/global.css';

import { Platform, type ViewStyle } from 'react-native';

export { Colors, type ThemeColor } from './colors';

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const Typography = {
  screenTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  cardTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700' as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700' as const,
  },
} as const;

export const Borders = {
  hairline: 1,
  accent: 3,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export function cardElevation(scheme: 'light' | 'dark'): ViewStyle {
  return (
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: scheme === 'light' ? 0.08 : 0.4,
        shadowRadius: 16,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow:
          scheme === 'light'
            ? '0 10px 28px rgba(15, 23, 42, 0.08)'
            : '0 10px 28px rgba(0, 0, 0, 0.35)',
      },
      default: {
        elevation: 3,
      },
    }) ?? { elevation: 3 }
  );
}

export {
  SourceColors,
  type SourceAppearanceTokens,
  type SourceColorScheme,
} from './source-colors';

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 720;
