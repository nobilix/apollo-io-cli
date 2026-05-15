import { getValidCredentials } from './credentials.js';
import type { ApolloJson } from './types.js';
import pkg from '../package.json' with { type: 'json' };

const API_HOST = 'https://api.apollo.io';
const BASE_URL = `${API_HOST}/api/v1`;

// Paths starting with "//" are mounted off the host root (e.g. //analytics/api/v1/...);
// regular paths resolve under /api/v1.
function resolvePath(path: string): string {
  if (path.startsWith('//')) return `${API_HOST}/${path.slice(2)}`;
  return `${BASE_URL}${path}`;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const envKey = process.env.APOLLO_API_KEY;
  if (envKey) {
    return { 'X-Api-Key': envKey };
  }
  const creds = await getValidCredentials();
  if (!creds) {
    console.error('Not logged in. Run: apollo auth login or apollo auth api-login');
    process.exit(1);
  }
  if (creds.type === 'api_key') {
    return { 'X-Api-Key': creds.api_key };
  }
  if (creds.expires_at !== null && Date.now() >= creds.expires_at) {
    console.error('Session expired. Run: apollo auth login');
    process.exit(1);
  }
  return { 'Authorization': `Bearer ${creds.access_token}` };
}

export type QueryParams = Record<string, string | number | boolean | string[] | number[] | undefined | null>;

export type HttpMethod = 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export async function apolloGet<T = ApolloJson>(path: string, params: QueryParams = {}): Promise<T> {
  const url = new URL(resolvePath(path));
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) url.searchParams.append(`${key}[]`, String(v));
    } else if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache',
      'User-Agent': `apollo-io-cli/${pkg.version}`,
      'X-Apollo-Source': 'apollo-cli',
      ...await getAuthHeaders(),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Apollo API error ${res.status}: ${text}`);
    process.exit(1);
  }
  return await res.json() as T;
}

// Lower-level GET that does NOT exit on non-2xx; lets callers verify ad-hoc
// credentials (e.g. an API key being validated by `auth api-login`) without
// touching getValidCredentials() or the saved credentials file.
export async function apolloGetWithHeaders<T = ApolloJson>(
  path: string,
  authHeaders: Record<string, string>,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(resolvePath(path), {
    method: 'GET',
    headers: {
      'Cache-Control': 'no-cache',
      'User-Agent': `apollo-io-cli/${pkg.version}`,
      'X-Apollo-Source': 'apollo-cli',
      ...authHeaders,
    },
  });
  const data = res.ok ? (await res.json()) as T : null;
  return { ok: res.ok, status: res.status, data };
}

export async function apolloRequest<T = ApolloJson>(
  path: string,
  body: Record<string, unknown> = {},
  method: HttpMethod = 'POST',
): Promise<T> {
  const res = await fetch(resolvePath(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'User-Agent': `apollo-io-cli/${pkg.version}`,
      'X-Apollo-Source': 'apollo-cli',
      ...await getAuthHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Apollo API error ${res.status}: ${text}`);
    process.exit(1);
  }

  return await res.json() as T;
}
