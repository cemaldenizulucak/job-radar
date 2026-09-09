import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('JobDetailScreen possible match copy', () => {
  it('shows the possible-match hint and does not invent description evidence', () => {
    const source = readFileSync(join(dir, 'job-detail-screen.tsx'), 'utf8');

    expect(source).toContain('possibleMatchBadge');
    expect(source).toContain('possibleMatchHint');
    expect(source).toContain('isUnverifiedSourceMatch');
    expect(source).not.toContain('açıklamada geçiyor');
  });
});
