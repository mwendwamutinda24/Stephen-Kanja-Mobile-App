import { deleteItem, getItem, setItem } from '@/services/storage/secureStorage';

const TOKEN_KEY = 'kanja_auth_token';

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://new-kanja-portal.onrender.com/api';

export async function setStoredToken(token: string): Promise<void> {
  await setItem(TOKEN_KEY, token);
}

export async function getStoredToken(): Promise<string | null> {
  return getItem(TOKEN_KEY);
}

export async function clearStoredToken(): Promise<void> {
  await deleteItem(TOKEN_KEY);
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  /** Attach the bearer token. Default true — pass false for login.php itself. */
  auth?: boolean;
};

/**
 * Thrown by apiRequest() on any failure. `status` carries the HTTP status
 * code when we got one (a real response from the server), and is left
 * undefined for network-level failures (fetch itself threw — DNS, offline,
 * CORS, timeout, etc.) or for responses that weren't valid JSON.
 *
 * Callers that need to distinguish "the server said this token is invalid"
 * (status 401/403) from "we couldn't talk to the server" or "the server had
 * a bad moment" (network error, 404, 500, ...) should check `status` rather
 * than treating every apiRequest() rejection as equivalent — a token should
 * only ever be cleared on a genuine 401/403, never on ambiguous failures.
 */
export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Every api/*.php endpoint returns { ok: true, ... } or
 * { ok: false, error, message } — see api/helpers/response.php.
 * This throws on both network failures and ok:false, so callers
 * only need one try/catch.
 */
export async function apiRequest<T = any>(
  path: string,
  { method = 'GET', body, auth = true }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {};

  if (auth) {
    headers['Content-Type'] = 'application/json';
    const token = await getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } else {
    headers['Content-Type'] = 'text/plain';
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network-level failure - fetch never got a response at all. This is
    // NOT evidence that the token/session is invalid, so callers must not
    // treat it as an auth failure (no status is attached).
    throw new ApiError('Could not reach the server. Check your connection and try again.');
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new ApiError('Server returned an unexpected response.', response.status);
  }

  if (!response.ok || data?.ok === false || data?.success === false) {
    throw new ApiError(data?.message ?? 'Something went wrong. Please try again.', response.status);
  }

  return data as T;
}