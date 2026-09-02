import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  isKariyerNetDebugHtmlEnabled,
  writeKariyerNetDebugHtml,
} from './kariyer-net-debug-html.js';

describe('isKariyerNetDebugHtmlEnabled', () => {
  it('is disabled by default', () => {
    expect(isKariyerNetDebugHtmlEnabled(undefined, 'development')).toBe(false);
    expect(isKariyerNetDebugHtmlEnabled('false', 'development')).toBe(false);
  });

  it('is disabled in test and production even when the flag is true', () => {
    expect(isKariyerNetDebugHtmlEnabled('true', 'test')).toBe(false);
    expect(isKariyerNetDebugHtmlEnabled('true', 'production')).toBe(false);
  });

  it('is enabled only in development when the flag is true', () => {
    expect(isKariyerNetDebugHtmlEnabled('true', 'development')).toBe(true);
  });
});

describe('writeKariyerNetDebugHtml', () => {
  it('writes HTML body only', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kariyer-net-debug-'));
    const filePath = join(directory, 'kariyer-net-last-response.html');

    try {
      await writeKariyerNetDebugHtml('<html>listing</html>', filePath);
      expect(await readFile(filePath, 'utf8')).toBe('<html>listing</html>');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
