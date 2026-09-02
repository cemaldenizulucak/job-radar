function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstNonEmptyString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return null;
}

/**
 * Reads a safe user-facing message from a Nest-style error body.
 * `{ message: string | string[], error?: string }`
 */
export function extractApiErrorMessage(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const message = value.message;
  if (typeof message === 'string') {
    return firstNonEmptyString(message);
  }

  if (Array.isArray(message)) {
    const parts = message
      .map((item) => firstNonEmptyString(item))
      .filter((item): item is string => item !== null);
    if (parts.length > 0) {
      return parts.join(' ');
    }
  }

  return firstNonEmptyString(value.error);
}

export function userErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
