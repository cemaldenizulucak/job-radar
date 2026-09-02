import { getApiBaseUrl } from './api-config';
import { extractApiErrorMessage } from './api-error';
import { supabase } from './supabase';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function readErrorMessage(value: unknown, status: number): string {
  if (status === 401) {
    return 'Your session expired. Sign in again.';
  }

  return extractApiErrorMessage(value) ?? `Request failed (${status}).`;
}

async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    return null;
  }

  return data.session.access_token;
}

async function apiRequest(
  method: 'GET' | 'PATCH' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<unknown> {
  const token = await getAccessToken();
  if (!token) {
    throw new ApiClientError('Your session expired. Sign in again.', 401);
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(`${getApiBaseUrl()}${normalizedPath}`, init);

  let payload: unknown = null;
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    payload = await response.json();
  }

  if (!response.ok) {
    throw new ApiClientError(readErrorMessage(payload, response.status), response.status);
  }

  return payload;
}

export async function apiGet(path: string): Promise<unknown> {
  return apiRequest('GET', path);
}

export async function apiPatch(path: string, body?: unknown): Promise<unknown> {
  return apiRequest('PATCH', path, body);
}

export async function apiPost(path: string, body: unknown): Promise<unknown> {
  return apiRequest('POST', path, body);
}

export async function apiDelete(path: string, body?: unknown): Promise<unknown> {
  return apiRequest('DELETE', path, body);
}
