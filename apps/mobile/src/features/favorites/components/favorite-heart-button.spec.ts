import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('FavoriteHeartButton', () => {
  it('uses a filled heart silhouette in both favorite and idle states', () => {
    const source = readFileSync(join(dir, 'favorite-heart-button.tsx'), 'utf8');

    expect(source).toContain("ios: 'heart.fill'");
    expect(source).toContain("android: 'favorite'");
    expect(source).toContain("web: 'favorite'");
    expect(source).toContain("isFavorite ? '#F43F5E' : theme.textSecondary");
    expect(source).toContain('accessibilityState={{ selected: isFavorite, disabled }}');
    expect(source).toContain('event.stopPropagation()');
    expect(source).toContain('width: 44');
    expect(source).toContain('height: 44');
    expect(source).not.toContain('favorite_border');
    expect(source).not.toContain("ios: 'heart',");
    expect(source).not.toContain("ios: 'heart' }");
  });
});
