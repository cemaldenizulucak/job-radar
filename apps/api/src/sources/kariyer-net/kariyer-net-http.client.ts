export type KariyerNetHttpResponse = {
  status: number;
  body: string;
  contentType: string;
  /** Final URL after redirects. Optional on test fakes; live fetch always sets it. */
  finalUrl?: string;
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
