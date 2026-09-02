import { describe, expect, it } from 'vitest';

import { extractApiErrorMessage, userErrorMessage } from './api-error';

describe('extractApiErrorMessage', () => {
  it('uses a Nest string message instead of a generic fallback', () => {
    expect(
      extractApiErrorMessage({
        statusCode: 400,
        message: 'Add at least one keyword.',
        error: 'Bad Request',
      }),
    ).toBe('Add at least one keyword.');
  });

  it('joins Nest message arrays', () => {
    expect(
      extractApiErrorMessage({
        statusCode: 400,
        message: ['name is required.', 'Select at least one source.'],
        error: 'Bad Request',
      }),
    ).toBe('name is required. Select at least one source.');
  });

  it('falls back to error when message is missing', () => {
    expect(extractApiErrorMessage({ error: 'Forbidden' })).toBe('Forbidden');
  });
});

describe('userErrorMessage', () => {
  it('prefers the thrown API message', () => {
    expect(userErrorMessage(new Error('Search not found.'), 'Failed to update search')).toBe(
      'Search not found.',
    );
  });

  it('uses the fallback only when no message exists', () => {
    expect(userErrorMessage({}, 'Couldn’t update this search.')).toBe(
      'Couldn’t update this search.',
    );
  });
});
