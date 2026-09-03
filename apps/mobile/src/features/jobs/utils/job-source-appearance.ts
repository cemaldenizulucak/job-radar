import {
  SourceColors,
  type SourceAppearanceTokens,
  type SourceColorScheme,
} from '../../../constants/source-colors';

export type JobSourceAppearance = SourceAppearanceTokens;

export function getJobSourceAppearance(
  source: unknown,
  scheme: SourceColorScheme = 'light',
): JobSourceAppearance {
  const palette = SourceColors[scheme] ?? SourceColors.light;

  if (source === 'linkedin') {
    return palette.linkedin;
  }

  if (source === 'kariyer_net') {
    return palette.kariyer_net;
  }

  return palette.fallback;
}
