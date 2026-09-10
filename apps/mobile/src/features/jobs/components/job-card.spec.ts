import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('JobCard favorite control', () => {
  it('keeps the heart outside the card press target so toggling does not open detail', () => {
    const source = readFileSync(join(dir, 'job-card.tsx'), 'utf8');

    expect(source).toContain('FavoriteHeartButton');
    expect(source.indexOf('FavoriteHeartButton')).toBeLessThan(source.indexOf('onPress={onPress}'));
    expect(source).toContain('paddingRight: 52');
    expect(source).toContain('numberOfLines={2}');
    expect(source).toContain('possibleMatchBadge');
    expect(source).toContain('possibleMatchHint');
    expect(source).not.toContain('açıklamada geçiyor');
  });
});
