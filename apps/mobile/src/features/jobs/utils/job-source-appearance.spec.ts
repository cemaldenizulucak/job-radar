import { describe, expect, it } from 'vitest';

import { SourceColors } from '../../../constants/source-colors';

import { getJobSourceAppearance } from './job-source-appearance';

describe('getJobSourceAppearance', () => {
  it('returns LinkedIn blue tokens', () => {
    expect(getJobSourceAppearance('linkedin', 'light')).toEqual({
      accentColor: '#0A66C2',
      badgeBackground: '#E7F0F9',
      badgeTextColor: '#0A66C2',
    });
    expect(getJobSourceAppearance('linkedin', 'light')).toEqual(
      SourceColors.light.linkedin,
    );
  });

  it('returns Kariyer.net purple tokens', () => {
    expect(getJobSourceAppearance('kariyer_net', 'light')).toEqual({
      accentColor: '#7C3AED',
      badgeBackground: '#F3EBFE',
      badgeTextColor: '#6D28D9',
    });
    expect(getJobSourceAppearance('kariyer_net', 'light')).toEqual(
      SourceColors.light.kariyer_net,
    );
  });

  it('falls back for an unknown source', () => {
    expect(getJobSourceAppearance('unknown', 'light')).toEqual(
      SourceColors.light.fallback,
    );
    expect(getJobSourceAppearance(undefined, 'dark')).toEqual(
      SourceColors.dark.fallback,
    );
  });

  it('keeps LinkedIn and Kariyer accents readable in dark mode', () => {
    const linkedIn = getJobSourceAppearance('linkedin', 'dark');
    const kariyer = getJobSourceAppearance('kariyer_net', 'dark');

    expect(linkedIn.badgeTextColor).not.toBe('#000000');
    expect(linkedIn.badgeTextColor).not.toBe(linkedIn.badgeBackground);
    expect(kariyer.badgeTextColor).not.toBe('#000000');
    expect(kariyer.badgeTextColor).not.toBe(kariyer.badgeBackground);
    expect(linkedIn.accentColor).toBe('#0A66C2');
    expect(kariyer.accentColor).toBe('#7C3AED');
  });
});
