/**
 * Fix #22: Test cho logic refresh token (Fix #7) trong http layer.
 *
 * Kiểm tra:
 *   - 401 → tự động refresh → retry request gốc thành công
 *   - Nhiều request 401 đồng thời → chỉ gọi /auth/refresh MỘT lần (single-flight)
 *   - Refresh thất bại → xoá token + gọi onAuthFailure
 */

const mockTokens: { accessToken: string | null; refreshToken: string | null } = {
  accessToken: "old-access",
  refreshToken: "valid-refresh",
};

jest.mock("../src/config/env", () => ({ API_BASE_URL: "http://test.local" }));

jest.mock("../src/storage/tokenStore", () => ({
  getTokens: jest.fn(async () => mockTokens),
  saveTokens: jest.fn(async (a: string, r: string) => {
    mockTokens.accessToken = a;
    mockTokens.refreshToken = r;
  }),
  clearTokens: jest.fn(async () => {
    mockTokens.accessToken = null;
    mockTokens.refreshToken = null;
  }),
}));

import { request, setOnAuthFailure } from "../src/services/http";
import { clearTokens, saveTokens } from "../src/storage/tokenStore";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("http request - token refresh (Fix #7)", () => {
  beforeEach(() => {
    mockTokens.accessToken = "old-access";
    mockTokens.refreshToken = "valid-refresh";
    (saveTokens as jest.Mock).mockClear();
    (clearTokens as jest.Mock).mockClear();
    setOnAuthFailure(null);
  });

  it("refreshes on 401 then retries the original request", async () => {
    const fetchMock = jest
      .fn()
      // 1) request gốc → 401
      .mockResolvedValueOnce(jsonResponse({ success: false, message: "expired" }, 401))
      // 2) gọi /auth/refresh → thành công
      .mockResolvedValueOnce(
        jsonResponse({ success: true, data: { accessToken: "new-access", refreshToken: "new-refresh" } }, 200)
      )
      // 3) retry request gốc → thành công
      .mockResolvedValueOnce(jsonResponse({ success: true, data: { value: 42 } }, 200));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await request<{ value: number }>("/api/v1/wallet/balance");

    expect(result).toEqual({ value: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(saveTokens).toHaveBeenCalledWith("new-access", "new-refresh");
  });

  it("only calls refresh once for concurrent 401s (single-flight)", async () => {
    let refreshCalls = 0;
    const fetchMock = jest.fn(async (url: string) => {
      if (url.endsWith("/api/v1/auth/refresh")) {
        refreshCalls += 1;
        return jsonResponse(
          { success: true, data: { accessToken: "new-access", refreshToken: "new-refresh" } },
          200
        );
      }
      // Request thường: token cũ → 401, token mới → 200
      if (mockTokens.accessToken === "new-access") {
        return jsonResponse({ success: true, data: { ok: true } }, 200);
      }
      return jsonResponse({ success: false, message: "expired" }, 401);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const [a, b, c] = await Promise.all([
      request("/api/v1/a"),
      request("/api/v1/b"),
      request("/api/v1/c"),
    ]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(c).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
  });

  it("clears tokens and triggers onAuthFailure when refresh fails", async () => {
    const onFail = jest.fn();
    setOnAuthFailure(onFail);

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ success: false, message: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: false, message: "invalid refresh" }, 401));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(request("/api/v1/wallet/balance")).rejects.toThrow();
    expect(clearTokens).toHaveBeenCalled();
    expect(onFail).toHaveBeenCalled();
  });
});
