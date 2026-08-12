import { API_BASE_URL } from "../config/env";
import { clearTokens, getTokens, saveTokens } from "../storage/tokenStore";
import type { ApiResponse, AuthResponse } from "../types/api";

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
  _isRetry?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;
let onAuthFailure: (() => void) | null = null;

export function setOnAuthFailure(handler: (() => void) | null) {
  onAuthFailure = handler;
}

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = await getTokens();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({ refreshToken }),
    });

    const payload = await parseJsonResponse<ApiResponse<AuthResponse>>(response);
    if (!response.ok || !payload.success || !payload.data) return null;

    await saveTokens(payload.data.accessToken, payload.data.refreshToken);
    return payload.data.accessToken;
  } catch {
    return null;
  }
}

async function performRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith("<")) {
    throw new Error(
      response.status === 404
        ? "API không tìm thấy — kiểm tra EXPO_PUBLIC_API_BASE_URL và backend đang chạy."
        : "Server trả về HTML thay vì JSON — kiểm tra URL ngrok/LAN.",
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error("Phản hồi API không hợp lệ (không phải JSON).");
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("ngrok-skip-browser-warning", "true");

  if (!options.skipAuth) {
    const { accessToken } = await getTokens();
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (response.status === 401 && !options.skipAuth && !options._isRetry) {
    const newAccessToken = await performRefresh();
    if (newAccessToken) return request<T>(path, { ...options, _isRetry: true });

    await clearTokens();
    onAuthFailure?.();
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  const payload = await parseJsonResponse<ApiResponse<T>>(response);

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Request failed");
  }

  return payload.data as T;
}
