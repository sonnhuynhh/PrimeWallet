import { API_BASE_URL } from "../config/env";
import { clearTokens, getTokens, saveTokens } from "../storage/tokenStore";
import type { ApiResponse, AuthResponse } from "../types/api";

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
  /** Nội bộ: đánh dấu request đã được thử lại sau refresh (tránh lặp vô hạn). */
  _isRetry?: boolean;
};

/**
 * Fix #7: Single-flight token refresh.
 *
 * Khi access token hết hạn (15 phút), backend trả 401. Trước đây app đăng xuất
 * người dùng ngay cả khi refresh token (7 ngày) vẫn còn hiệu lực.
 *
 * Giờ ta bắt 401 → gọi /auth/refresh → thử lại request gốc.
 * Dùng biến `refreshPromise` để nếu NHIỀU request cùng nhận 401 một lúc,
 * chỉ có ĐÚNG MỘT lần gọi refresh; các request khác chờ chung kết quả đó.
 */
let refreshPromise: Promise<string | null> | null = null;

/**
 * Callback được AuthContext đăng ký để khi refresh thất bại (refresh token hết hạn),
 * app tự đăng xuất và điều hướng về màn Login.
 */
let onAuthFailure: (() => void) | null = null;

export function setOnAuthFailure(handler: (() => void) | null) {
  onAuthFailure = handler;
}

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken } = await getTokens();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const payload = (await response.json()) as ApiResponse<AuthResponse>;

    if (!response.ok || !payload.success || !payload.data) {
      return null;
    }

    await saveTokens(payload.data.accessToken, payload.data.refreshToken);
    return payload.data.accessToken;
  } catch {
    return null;
  }
}

async function performRefresh(): Promise<string | null> {
  // Nếu đang có một lần refresh chạy dở, dùng chung promise đó.
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (!options.skipAuth) {
    const { accessToken } = await getTokens();
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Fix #7: Bắt 401 → thử refresh token rồi retry (chỉ 1 lần, và không áp dụng
  // cho chính request có skipAuth như login/register/refresh).
  if (response.status === 401 && !options.skipAuth && !options._isRetry) {
    const newAccessToken = await performRefresh();

    if (newAccessToken) {
      return request<T>(path, { ...options, _isRetry: true });
    }

    // Refresh thất bại → xoá token và báo cho app đăng xuất.
    await clearTokens();
    onAuthFailure?.();
    throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  }

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Request failed");
  }

  return payload.data as T;
}
