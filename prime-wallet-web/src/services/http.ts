import { API_BASE_URL } from "../config/env";
import { getTokens, saveTokens, clearTokens } from "../storage/tokenStore";
import type { ApiResponse, AuthResponse } from "../types/api";

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
};

export class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const { refreshToken } = await getTokens();
    if (!refreshToken) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const payload = (await response.json()) as ApiResponse<AuthResponse>;
      if (!response.ok || !payload.success || !payload.data) {
        await clearTokens();
        return null;
      }
      const auth = payload.data;
      await saveTokens(auth.accessToken, auth.refreshToken);
      return auth.accessToken;
    } catch {
      await clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function request<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  let accessToken: string | null = null;
  if (!options.skipAuth) {
    ({ accessToken } = await getTokens());
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  const doFetch = () =>
    fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

  let response = await doFetch();

  if (response.status === 401 && !options.skipAuth) {
    const newToken = await tryRefreshAccessToken();
    if (newToken) {
      headers.set("Authorization", `Bearer ${newToken}`);
      response = await doFetch();
    }
  }

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new HttpError("Phản hồi máy chủ không hợp lệ", response.status);
  }

  if (!response.ok || !payload.success) {
    throw new HttpError(payload.message || "Request failed", response.status);
  }

  return payload.data as T;
}
