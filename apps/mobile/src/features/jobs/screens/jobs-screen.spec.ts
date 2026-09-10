import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('JobsScreen match tabs', () => {
  it('splits verified and possible matches into separate tabs with user counts', () => {
    const source = readFileSync(join(dir, 'jobs-screen.tsx'), 'utf8');

    expect(source).toContain("id: 'matched'");
    expect(source).toContain("id: 'possible'");
    expect(source).toContain('matchResultsTabLabel');
    expect(source).toContain('verifiedMatchCount');
    expect(source).toContain('unverifiedMatchCount');
    expect(source).toContain("return 'verified'");
    expect(source).toContain("resultsView !== 'all'");
    expect(source).toContain('filterJobs(items, sourceId, selectedSearchId, matchStatus)');
    expect(source).not.toContain('açıklamada geçiyor');
  });
});
