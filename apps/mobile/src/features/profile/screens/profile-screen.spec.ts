import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const dir = dirname(fileURLToPath(import.meta.url));

describe('ProfileScreen Telegram section', () => {
  it('renders Telegram notifications settings on the profile screen', () => {
    const source = readFileSync(join(dir, 'profile-screen.tsx'), 'utf8');

    expect(source).toContain('TelegramSettingsSection');
    expect(source).not.toContain('telegramUsername');
    expect(source).not.toContain('chatId');
  });
});
