import type { SourceId } from '../common/domain.types.js';

export type SourceErrorCategory =
  | 'authentication'
  | 'blocked'
  | 'challenge'
  | 'rate_limit'
  | 'unavailable'
  | 'configuration'
  | 'parse';

export class SourceError extends Error {
  readonly sourceId: SourceId;
  readonly category: SourceErrorCategory;

  constructor(
    sourceId: SourceId,
    category: SourceErrorCategory,
    message: string,
  ) {
    super(message);
    this.name = 'SourceError';
    this.sourceId = sourceId;
    this.category = category;
  }
}

export class SourceAuthenticationError extends SourceError {
  constructor(sourceId: SourceId, message: string) {
    super(sourceId, 'authentication', message);
    this.name = 'SourceAuthenticationError';
  }
}

export class SourceBlockedError extends SourceError {
  constructor(sourceId: SourceId, message: string) {
    super(sourceId, 'blocked', message);
    this.name = 'SourceBlockedError';
  }
}

export class SourceChallengeError extends SourceError {
  constructor(sourceId: SourceId, message: string) {
    super(sourceId, 'challenge', message);
    this.name = 'SourceChallengeError';
  }
}

export class SourceRateLimitError extends SourceError {
  constructor(sourceId: SourceId, message: string) {
    super(sourceId, 'rate_limit', message);
    this.name = 'SourceRateLimitError';
  }
}

export class SourceUnavailableError extends SourceError {
  constructor(sourceId: SourceId, message: string) {
    super(sourceId, 'unavailable', message);
    this.name = 'SourceUnavailableError';
  }
}

export class SourceConfigurationError extends SourceError {
  constructor(sourceId: SourceId, message: string) {
    super(sourceId, 'configuration', message);
    this.name = 'SourceConfigurationError';
  }
}

export class SourceParseError extends SourceError {
  constructor(sourceId: SourceId, message: string) {
    super(sourceId, 'parse', message);
    this.name = 'SourceParseError';
  }
}

export function isSourceError(error: unknown): error is SourceError {
  return error instanceof SourceError;
}

export function sourceErrorCategory(error: unknown): SourceErrorCategory | 'unknown' {
  return isSourceError(error) ? error.category : 'unknown';
}

export function isSourceCircuitBreakError(error: unknown): boolean {
  const category = sourceErrorCategory(error);
  return (
    category === 'challenge' ||
    category === 'blocked' ||
    category === 'rate_limit' ||
    category === 'authentication'
  );
}

export function isSourceChallengeOrBlock(error: unknown): boolean {
  const category = sourceErrorCategory(error);
  return category === 'challenge' || category === 'blocked';
}
