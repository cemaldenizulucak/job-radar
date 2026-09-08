import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

function source(relativePath: string): string {
  return readFileSync(join(dir, relativePath), 'utf8');
}

describe('saved search create and edit screens', () => {
  it('does not offer a work-model selector', () => {
    const files = [
      source('./saved-search-form.tsx'),
      source('../screens/create-search-screen.tsx'),
      source('../screens/edit-search-screen.tsx'),
    ];

    for (const contents of files) {
      expect(contents).not.toContain('WorkTypeSelector');
      expect(contents).not.toMatch(/searchesCopy\.workTypes\b/);
      expect(contents).not.toContain('Uzaktan');
      expect(contents).not.toContain('Hibrit');
      expect(contents).not.toContain('Ofiste');
      expect(contents).not.toContain('Ofisten');
    }
  });
});
