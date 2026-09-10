export type KariyerNetHttpResponse = {
  status: number;
  body: string;
  contentType: string;
  /** Final URL after redirects. Optional on test fakes; live fetch always sets it. */
  finalUrl?: string;
  retryAfterSeconds?: number | null;
};

export type KariyerNetHttpRequest = {
  url: string;
  timeoutMs: number;
  userAgent: string;
};

export interface KariyerNetHttpClient {
  get(request: KariyerNetHttpRequest): Promise<KariyerNetHttpResponse>;
}

export function createKariyerNetFetchClient(): KariyerNetHttpClient {
  return {
    async get(request) {
      const response = await fetch(request.url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Accept: 'text/html,application/xhtml+xml;q=0.9',
          'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
          'User-Agent': request.userAgent,
        },
        signal: AbortSignal.timeout(request.timeoutMs),
      });

      return {
        status: response.status,
        body: await response.text(),
        contentType: response.headers.get('content-type') ?? '',
        finalUrl: response.url,
        retryAfterSeconds: parseRetryAfterHeader(response.headers.get('retry-after')),
      };
    },
  };
}

export function isTimeoutError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const name = 'name' in error ? String(error.name) : '';
  return name === 'TimeoutError' || name === 'AbortError';
}

export const KARIYER_NET_MAX_RETRY_AFTER_MS = 30_000;

export function parseRetryAfterHeader(
  value: string | null | undefined,
): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }

  const dateMs = Date.parse(trimmed);
  if (!Number.isFinite(dateMs)) {
    return null;
  }

  return Math.max(0, Math.ceil((dateMs - Date.now()) / 1000));
}

export function retryAfterWaitMs(seconds: number | null | undefined): number | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  const waitMs = seconds * 1000;
  if (waitMs > KARIYER_NET_MAX_RETRY_AFTER_MS) {
    return null;
  }

  return waitMs;
}
