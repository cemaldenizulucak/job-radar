import { Colors } from '../../../constants/colors';

import type { ApplicationStatus } from '../types/application.types';

type ColorScheme = keyof typeof Colors;

export type StatusAppearance = {
  accentColor: string;
  backgroundColor: string;
  textColor: string;
};

export function getApplicationStatusAppearance(
  status: ApplicationStatus,
  scheme: ColorScheme = 'light',
): StatusAppearance {
  const palette = Colors[scheme];

  switch (status) {
    case 'NEW':
      return {
        accentColor: palette.accent,
        backgroundColor: palette.accentMuted,
        textColor: palette.accent,
      };
    case 'REVIEWING':
      return {
        accentColor: palette.warning,
        backgroundColor: palette.warningMuted,
        textColor: palette.warning,
      };
    case 'APPLIED':
      return {
        accentColor: palette.accent,
        backgroundColor: palette.accentMuted,
        textColor: palette.accent,
      };
    case 'INTERVIEW':
      return {
        accentColor: palette.secondary,
        backgroundColor: palette.secondaryMuted,
        textColor: palette.secondary,
      };
    case 'OFFER':
      return {
        accentColor: palette.success,
        backgroundColor: palette.successMuted,
        textColor: palette.success,
      };
    case 'REJECTED':
      return {
        accentColor: palette.danger,
        backgroundColor: palette.dangerMuted,
        textColor: palette.danger,
      };
  }
}
