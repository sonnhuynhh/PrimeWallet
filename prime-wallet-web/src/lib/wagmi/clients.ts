import { createPublicClient, http, type PublicClient } from 'viem';
import { chainOf, rpcOf, type NetworkId } from './chains';

/**
 * PublicClient dùng chung cho các tác vụ CHỈ ĐỌC on-chain
 * (quote swap, đọc allowance, đọc số dư token, mô phỏng tx).
 *
 * Cache theo `networkId + rpcUrl` để không tạo client mới mỗi lần render.
 * Bật `batch.multicall` — engine swap gọi hàng chục lần đọc mỗi lần quote,
 * gộp lại thành 1 request qua Multicall3 giúp tránh bị RPC công cộng rate-limit.
 */

const clientCache = new Map<string, PublicClient>();

export function getPublicClient(networkId: string, rpcUrl?: string | null): PublicClient {
  const resolvedRpc = rpcOf(networkId, rpcUrl);
  const cacheKey = `${networkId}|${resolvedRpc}`;

  const cached = clientCache.get(cacheKey);
  if (cached) return cached;

  const client = createPublicClient({
    chain: chainOf(networkId),
    transport: http(resolvedRpc, {
      // RPC công cộng hay chập chờn — thử lại 2 lần trước khi báo lỗi.
      retryCount: 2,
      retryDelay: 400,
      timeout: 15_000,
    }),
    batch: {
      multicall: { batchSize: 1024, wait: 16 },
    },
  }) as PublicClient;

  clientCache.set(cacheKey, client);
  return client;
}

/** Xoá cache khi RPC đổi (VD backend cập nhật cấu hình mạng). */
export function resetPublicClients() {
  clientCache.clear();
}

export type { NetworkId };
