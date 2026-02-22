/**
 * FASI API Service
 * Centralized HTTP client with JWT authentication, token refresh, and error handling
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// ─────────────────────────────────────────────
// Token Management (localStorage)
// ─────────────────────────────────────────────

export const TokenStorage = {
  getAccess: () => localStorage.getItem('fasi_access_token'),
  getRefresh: () => localStorage.getItem('fasi_refresh_token'),
  setTokens: (access: string, refresh: string) => {
    localStorage.setItem('fasi_access_token', access);
    localStorage.setItem('fasi_refresh_token', refresh);
  },
  setAccess: (access: string) => localStorage.setItem('fasi_access_token', access),
  clear: () => {
    localStorage.removeItem('fasi_access_token');
    localStorage.removeItem('fasi_refresh_token');
    localStorage.removeItem('fasi_user');
  },
};

// ─────────────────────────────────────────────
// Core fetch wrapper with auth + refresh logic
// ─────────────────────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

const processQueue = (token: string) => {
  refreshQueue.forEach(cb => cb(token));
  refreshQueue = [];
};

async function refreshAccessToken(): Promise<string> {
  const refreshToken = TokenStorage.getRefresh();
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${BASE_URL}/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!res.ok) {
    TokenStorage.clear();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  const data = await res.json();
  TokenStorage.setAccess(data.access);
  return data.access;
}

type RequestOptions = RequestInit & { skipAuth?: boolean };

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuth = false, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };

  if (!skipAuth) {
    const token = TokenStorage.getAccess();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  let response = await fetch(url, { ...fetchOptions, headers });

  // Auto-refresh on 401
  if (response.status === 401 && !skipAuth) {
    if (isRefreshing) {
      // Queue this request until token is refreshed
      const newToken = await new Promise<string>((resolve) => {
        refreshQueue.push(resolve);
      });
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, { ...fetchOptions, headers });
    } else {
      isRefreshing = true;
      try {
        const newToken = await refreshAccessToken();
        processQueue(newToken);
        headers['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(url, { ...fetchOptions, headers });
      } finally {
        isRefreshing = false;
      }
    }
  }

  if (!response.ok) {
    let errorData: unknown;
    try { errorData = await response.json(); } catch { errorData = { detail: response.statusText }; }
    throw new ApiError(response.status, errorData);
  }

  // Handle empty responses (204, etc.)
  if (response.status === 204) return null as T;

  return response.json() as Promise<T>;
}

// ─────────────────────────────────────────────
// ApiError class
// ─────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super(extractMessage(data));
    this.status = status;
    this.data = data;
  }

  /** Returns a human-readable message from DRF error response */
  get userMessage(): string {
    return extractMessage(this.data);
  }
}

function extractMessage(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (d.detail) return String(d.detail);
    if (d.message) return String(d.message);
    if (d.error) return String(d.error);
    // DRF field errors: { field: ["message"] }
    const first = Object.values(d)[0];
    if (Array.isArray(first)) return String(first[0]);
  }
  return 'Une erreur est survenue';
}

// ─────────────────────────────────────────────
// Convenience helpers
// ─────────────────────────────────────────────

export const api = {
  get: <T>(endpoint: string, opts?: RequestOptions) =>
    apiFetch<T>(endpoint, { method: 'GET', ...opts }),

  post: <T>(endpoint: string, body?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      ...opts,
    }),

  patch: <T>(endpoint: string, body?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...opts,
    }),

  put: <T>(endpoint: string, body?: unknown, opts?: RequestOptions) =>
    apiFetch<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...opts,
    }),

  delete: <T>(endpoint: string, opts?: RequestOptions) =>
    apiFetch<T>(endpoint, { method: 'DELETE', ...opts }),
};