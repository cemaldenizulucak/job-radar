import { describe, expect, it } from 'vitest';

import {
  jobCardAccessibilityLabel,
  jobCardAppearance,
} from './job-card-appearance';

describe('jobCardAppearance', () => {
  it('shows NEW and unread styling for an unseen new job', () => {
    expect(jobCardAppearance({ isNew: true, isSeen: false })).toEqual({
      isUnread: true,
      showNewBadge: true,
      titleWeight: '700',
    });
  });

  it('shows unread styling only for an unseen older job', () => {
    expect(jobCardAppearance({ isNew: false, isSeen: false })).toEqual({
      isUnread: true,
      showNewBadge: false,
      titleWeight: '700',
    });
  });

  it('keeps NEW without unread styling for a seen new job', () => {
    expect(jobCardAppearance({ isNew: true, isSeen: true })).toEqual({
      isUnread: false,
      showNewBadge: true,
      titleWeight: '500',
    });
  });

  it('uses the normal card for a seen older job', () => {
    expect(jobCardAppearance({ isNew: false, isSeen: true })).toEqual({
      isUnread: false,
      showNewBadge: false,
      titleWeight: '500',
    });
  });
});

describe('jobCardAccessibilityLabel', () => {
  it('does not rely on color alone for unread and new jobs', () => {
    expect(
      jobCardAccessibilityLabel({
        title: 'Frontend Developer',
        companyName: 'Acme',
        isUnread: true,
        isNew: true,
      }),
    ).toBe('Unread, New, Frontend Developer at Acme');
  });

  it('omits unread after the job has been seen', () => {
    expect(
      jobCardAccessibilityLabel({
        title: 'Frontend Developer',
        companyName: 'Acme',
        isUnread: false,
        isNew: true,
      }),
    ).toBe('New, Frontend Developer at Acme');
  });
});
