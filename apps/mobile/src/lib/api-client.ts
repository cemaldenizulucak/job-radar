import { uiCopy } from '@/constants/ui';
import { getApiBaseUrl, logDevApiRequestFailure } from './api-config';
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
    return uiCopy.sessionExpired;
  }

  return extractApiErrorMessage(value) ?? `İstek başarısız oldu (${status}).`;
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
  auth: 'required' | 'optional' = 'required',
): Promise<unknown> {
  const token = await getAccessToken();
  if (!token && auth !== 'optional') {
    throw new ApiClientError(uiCopy.sessionExpired, 401);
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const init: RequestInit = { method, headers };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const url = `${getApiBaseUrl()}${normalizedPath}`;
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    logDevApiRequestFailure({ endpoint: normalizedPath, error });
    throw error;
  }

  let payload: unknown = null;
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    payload = await response.json();
  }

  if (!response.ok) {
    const error = new ApiClientError(
      readErrorMessage(payload, response.status),
      response.status,
    );
    logDevApiRequestFailure({ endpoint: normalizedPath, error });
    throw error;
  }

  return payload;
}

export async function apiGet(path: string): Promise<unknown> {
  return apiRequest('GET', path);
}

/** Public catalog routes. Sends a bearer token when present, but does not require one. */
export async function apiGetPublic(path: string): Promise<unknown> {
  return apiRequest('GET', path, undefined, 'optional');
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
