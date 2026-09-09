import { MATCH_STATUS } from '../matching/match-status.js';
import {
  TELEGRAM_MAX_MESSAGE_LENGTH,
  groupJobsForTelegram,
  isSafeHttpUrl,
  matchStatusLabel,
  splitTelegramMessages,
} from './telegram-message.js';
import type { TelegramJobItem, TelegramNotifyInput } from './telegram-types.js';

function input(
  overrides: Partial<TelegramNotifyInput> = {},
): TelegramNotifyInput {
  return {
    matches: [
      {
        jobId: 'job-1',
        savedSearchId: 'search-a',
        matchStatus: MATCH_STATUS.verified,
      },
    ],
    jobs: [
      {
        id: 'job-1',
        sourceId: 'kariyer_net',
        title: 'Frontend Developer',
        companyName: 'ACME',
        location: 'İstanbul',
        canonicalUrl: 'https://www.kariyer.net/is-ilani/job-1',
      },
    ],
    searches: [{ id: 'search-a', name: 'Frontend', userId: 'user-1' }],
    ...overrides,
  };
}

function item(overrides: Partial<TelegramJobItem> = {}): TelegramJobItem {
  return {
    jobId: 'job-1',
    userId: 'user-1',
    title: 'Frontend Developer',
    companyName: 'ACME',
    location: 'İstanbul',
    sourceId: 'kariyer_net',
    matchStatus: MATCH_STATUS.verified,
    searchNames: ['Frontend'],
    listingUrl: 'https://www.kariyer.net/is-ilani/job-1',
    ...overrides,
  };
}

describe('telegram message formatting', () => {
  it('formats a verified Kariyer.net listing', () => {
    const [message] = splitTelegramMessages(groupJobsForTelegram(input()));

    expect(message?.text).toBe(
      [
        '🔔 Yeni iş ilanı',
        '',
        'Pozisyon: Frontend Developer',
        'Şirket: ACME',
        'Konum: İstanbul',
        'Kaynak: Kariyer.net',
        'Eşleşme: Doğrulanmış',
        'Arama: Frontend',
        'İlanı aç: https://www.kariyer.net/is-ilani/job-1',
      ].join('\n'),
    );
    expect(message?.text).toContain('Pozisyon: Frontend Developer');
    expect(message?.text).toContain('Eşleşme: Doğrulanmış');
    expect(message?.text).toContain('Kaynak: Kariyer.net');
    expect(message?.text.startsWith('🔔 Yeni iş ilanı')).toBe(true);
    expect(message?.jobIds).toEqual(['job-1']);
  });

  it('labels unverified source candidates as possible matches', () => {
    expect(matchStatusLabel(MATCH_STATUS.unverifiedSourceCandidate)).toBe(
      'Olası eşleşme',
    );

    const [message] = splitTelegramMessages(
      groupJobsForTelegram(
        input({
          matches: [
            {
              jobId: 'job-1',
              savedSearchId: 'search-a',
              matchStatus: MATCH_STATUS.unverifiedSourceCandidate,
            },
          ],
        }),
      ),
    );

    expect(message?.text).toContain('Eşleşme: Olası eşleşme');
    expect(message?.text).not.toContain('Doğrulanmış');
  });

  it('merges one listing that matched several searches into a single body', () => {
    const grouped = groupJobsForTelegram(
      input({
        matches: [
          {
            jobId: 'job-1',
            savedSearchId: 'search-a',
            matchStatus: MATCH_STATUS.unverifiedSourceCandidate,
          },
          {
            jobId: 'job-1',
            savedSearchId: 'search-b',
            matchStatus: MATCH_STATUS.verified,
          },
        ],
        searches: [
          { id: 'search-a', name: 'Frontend', userId: 'user-1' },
          { id: 'search-b', name: 'Angular', userId: 'user-1' },
        ],
      }),
    );

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.searchNames).toEqual(['Frontend', 'Angular']);
    expect(grouped[0]?.matchStatus).toBe(MATCH_STATUS.verified);

    const [message] = splitTelegramMessages(grouped);
    expect(message?.text).toContain('Arama: Frontend, Angular');
    expect(message?.text).toContain('Eşleşme: Doğrulanmış');
  });

  it('groups several new listings into one summary and splits over the length cap', () => {
    const many = Array.from({ length: 40 }, (_, index) =>
      item({
        jobId: `job-${index}`,
        title: `Uzun pozisyon başlığı ${index} ${'A'.repeat(80)}`,
        listingUrl: `https://www.kariyer.net/is-ilani/job-${index}`,
      }),
    );

    const messages = splitTelegramMessages(many);
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((message) => message.text.length <= TELEGRAM_MAX_MESSAGE_LENGTH)).toBe(
      true,
    );
    expect(messages[0]?.text.startsWith('🔔')).toBe(true);
    expect(messages.some((message) => message.text.includes('yeni iş ilanı'))).toBe(
      true,
    );
    expect(messages.flatMap((message) => message.jobIds)).toHaveLength(40);
  });

  it('omits listing links that are not http or https', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(isSafeHttpUrl('ftp://files.example/job')).toBeNull();
    expect(isSafeHttpUrl('not-a-url')).toBeNull();
    expect(isSafeHttpUrl('https://example.com/job')).toBe(
      'https://example.com/job',
    );

    const [message] = splitTelegramMessages(
      groupJobsForTelegram(
        input({
          jobs: [
            {
              id: 'job-1',
              sourceId: 'kariyer_net',
              title: 'Frontend Developer',
              companyName: 'ACME',
              location: 'İstanbul',
              canonicalUrl: 'javascript:alert(1)',
            },
          ],
        }),
      ),
    );

    expect(message?.text).not.toContain('İlanı aç:');
    expect(message?.text).not.toContain('javascript:');
  });

  it('keeps the same listing separate when two users matched it', () => {
    const grouped = groupJobsForTelegram(
      input({
        matches: [
          {
            jobId: 'job-1',
            savedSearchId: 'search-a',
            matchStatus: MATCH_STATUS.verified,
          },
          {
            jobId: 'job-1',
            savedSearchId: 'search-b',
            matchStatus: MATCH_STATUS.verified,
          },
        ],
        searches: [
          { id: 'search-a', name: 'Frontend', userId: 'user-1' },
          { id: 'search-b', name: 'Backend', userId: 'user-2' },
        ],
      }),
    );

    expect(grouped).toHaveLength(2);
    expect(grouped.find((row) => row.userId === 'user-1')?.searchNames).toEqual([
      'Frontend',
    ]);
    expect(grouped.find((row) => row.userId === 'user-2')?.searchNames).toEqual([
      'Backend',
    ]);
  });
});
