import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('JobsScreen listing layout', () => {
  it('uses scoped API counters and a compact filter layout', () => {
    const source = readFileSync(join(dir, 'jobs-screen.tsx'), 'utf8');

    expect(source).toContain("id: 'matched'");
    expect(source).toContain("id: 'possible'");
    expect(source).toContain("id: 'all'");
    expect(source).toContain('matchResultsTabLabel');
    expect(source).toContain('sourceFilterLabel');
    expect(source).toContain('verifiedMatchCount');
    expect(source).toContain('unverifiedMatchCount');
    expect(source).toContain('allMatchCount');
    expect(source).toContain('savedSearchAllCount');
    expect(source).toContain('sourceCounts');
    expect(source).toContain('SavedSearchSelector');
    expect(source).toContain('clearListingFilters');
    expect(source).toContain('possibleMatchesExplainer');
    expect(source).toContain('countsReady');
    expect(source).not.toContain('SummaryPill');
    expect(source).not.toContain('summaryTotal');
    expect(source).not.toContain('filterJobs(');
    expect(source).not.toContain('açıklamada geçiyor');
  });
});
