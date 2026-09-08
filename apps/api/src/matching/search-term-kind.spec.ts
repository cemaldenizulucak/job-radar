import { describe, expect, it } from 'vitest';

import { shouldBlockDescriptionKeyword } from './profession-conflict.js';
import { isRoleSearchTerm } from './search-term-kind.js';

describe('isRoleSearchTerm', () => {
  it('treats frontend and developer phrases as roles', () => {
    expect(isRoleSearchTerm('Frontend')).toBe(true);
    expect(isRoleSearchTerm('Frontend Developer')).toBe(true);
    expect(isRoleSearchTerm('gıda mühendisi')).toBe(true);
  });

  it('treats UI and JavaScript as skills, not frontend aliases', () => {
    expect(isRoleSearchTerm('UI')).toBe(false);
    expect(isRoleSearchTerm('JavaScript')).toBe(false);
    expect(isRoleSearchTerm('developer')).toBe(true);
  });
});

describe('shouldBlockDescriptionKeyword', () => {
  it('blocks food role text on a machine-engineer title', () => {
    expect(
      shouldBlockDescriptionKeyword('Makine Mühendisi', 'gıda mühendisi'),
    ).toBe(true);
    expect(
      shouldBlockDescriptionKeyword('Makine Mühendisi', 'kalite güvence'),
    ).toBe(true);
  });

  it('does not block an explicit JavaScript skill on a machine-engineer title', () => {
    expect(
      shouldBlockDescriptionKeyword('Makine Mühendisi', 'JavaScript'),
    ).toBe(false);
  });
});
