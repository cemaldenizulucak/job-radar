export const TRANSIENT_QUERY_MAX_ATTEMPTS = 3;
const TRANSIENT_QUERY_BASE_DELAY_MS = 200;

export type TransientQueryKind = 'transient' | 'permanent';

export type TransientQueryTelemetry = {
  attemptCount: number;
  recoveredAfterRetry: boolean;
};

export type TransientQueryResult<T> = TransientQueryTelemetry & {
  value: T;
};

export type TransientQueryClock = {
  sleep(ms: number): Promise<void>;
  random(): number;
};

export const transientQueryClock: TransientQueryClock = {
  sleep(ms) {
    if (ms <= 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  },
  random() {
    return Math.random();
  },
};

const TRANSIENT_CODES = new Set(['PGRST303']);
const TRANSIENT_STATUS_CODES = new Set([502, 503, 504]);
const TRANSIENT_NODE_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENETUNREACH',
  'EAI_AGAIN',
]);
const PERMANENT_CODES = new Set([
  'PGRST204',
  'PGRST301',
  'PGRST302',
  '42501',
  '28000',
  '28P01',
]);

/**
 * Classifies PostgREST / network failures for scheduler-critical reads.
 * Auth, RLS, missing columns, and bad credentials are never retried.
 */
export function classifySupabaseFailure(error: unknown): TransientQueryKind {
  const code = readErrorCode(error);
  if (code && TRANSIENT_CODES.has(code)) {
    return 'transient';
  }
  if (code && PERMANENT_CODES.has(code)) {
    return 'permanent';
  }

  const status = readHttpStatus(error);
  if (status !== null && TRANSIENT_STATUS_CODES.has(status)) {
    return 'transient';
  }

  const nodeCode = readNodeCode(error);
  if (nodeCode && TRANSIENT_NODE_CODES.has(nodeCode)) {
    return 'transient';
  }

  const message = readErrorMessage(error);
  if (isPermanentAuthOrSchemaMessage(message)) {
    return 'permanent';
  }
  if (isTransientNetworkMessage(message) || /jwt issued at future/i.test(message)) {
    return 'transient';
  }
  if (status === 401 || status === 403) {
    return 'permanent';
  }

  return 'permanent';
}

export async function retryTransientQuery<T>(
  operation: () => Promise<T>,
  clock: TransientQueryClock = transientQueryClock,
): Promise<TransientQueryResult<T>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= TRANSIENT_QUERY_MAX_ATTEMPTS; attempt += 1) {
    try {
      const value = await operation();
      return {
        value,
        attemptCount: attempt,
        recoveredAfterRetry: attempt > 1,
      };
    } catch (error) {
      lastError = error;
      if (
        classifySupabaseFailure(error) !== 'transient' ||
        attempt >= TRANSIENT_QUERY_MAX_ATTEMPTS
      ) {
        throw error;
      }

      await clock.sleep(transientRetryDelayMs(attempt, clock.random()));
    }
  }

  throw lastError;
}

export function transientRetryDelayMs(
  failedAttempt: number,
  randomValue: number,
): number {
  const exp = TRANSIENT_QUERY_BASE_DELAY_MS * 2 ** Math.max(0, failedAttempt - 1);
  const unit = Number.isFinite(randomValue) ? Math.min(1, Math.max(0, randomValue)) : 0;
  return exp + Math.floor(unit * TRANSIENT_QUERY_BASE_DELAY_MS);
}

export function supabaseFailureLogFields(error: unknown): {
  code: string | null;
  message: string;
} {
  return {
    code: readErrorCode(error),
    message: redactSensitive(readErrorMessage(error) || 'unknown'),
  };
}

function isPermanentAuthOrSchemaMessage(message: string): boolean {
  return (
    /permission denied|row[- ]level security|\brls\b|invalid api key|invalid jwt|jwsError|jwt expired|column .* does not exist|schema cache/i.test(
      message,
    )
  );
}

function isTransientNetworkMessage(message: string): boolean {
  return (
    /fetch failed|econnreset|econnrefused|etimedout|socket hang up|network|temporarily unavailable|connection reset/i.test(
      message,
    )
  );
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  if ('code' in error && typeof error.code === 'string' && error.code.trim()) {
    return error.code.trim();
  }

  return null;
}

function readNodeCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  if ('code' in error && typeof error.code === 'string') {
    return error.code;
  }

  const cause =
    'cause' in error && typeof error.cause === 'object' && error.cause !== null
      ? error.cause
      : null;
  if (cause && 'code' in cause && typeof cause.code === 'string') {
    return cause.code;
  }

  return null;
}

function readHttpStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  for (const key of ['status', 'statusCode'] as const) {
    if (key in error) {
      const value = (error as { status?: unknown; statusCode?: unknown })[key];
      if (typeof value === 'number') {
        return value;
      }
    }
  }

  if (
    'context' in error &&
    typeof error.context === 'object' &&
    error.context !== null &&
    'status' in error.context &&
    typeof error.context.status === 'number'
  ) {
    return error.context.status;
  }

  return null;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return typeof error === 'string' ? error : '';
}

function redactSensitive(message: string): string {
  return message
    .replace(/bearer\s+[a-z0-9._\-+=/]+/gi, 'bearer [redacted]')
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[redacted-jwt]')
    .replace(/\b(sb_secret|service_role|apikey)[=: ]+\S+/gi, '$1=[redacted]');
}
