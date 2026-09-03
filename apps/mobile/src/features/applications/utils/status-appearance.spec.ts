import { describe, expect, it } from 'vitest';

import { getApplicationStatusAppearance } from './status-appearance';

describe('getApplicationStatusAppearance', () => {
  it('uses blue for applied, purple for interview, green for offer, red for rejected', () => {
    expect(getApplicationStatusAppearance('APPLIED', 'light').accentColor).toBe(
      '#2563EB',
    );
    expect(getApplicationStatusAppearance('INTERVIEW', 'light').accentColor).toBe(
      '#7C3AED',
    );
    expect(getApplicationStatusAppearance('OFFER', 'light').accentColor).toBe(
      '#16A34A',
    );
    expect(getApplicationStatusAppearance('REJECTED', 'light').accentColor).toBe(
      '#DC2626',
    );
  });
});
