/**
 * Biến môi trường tuỳ chọn.
 *
 * Không có key nào là bắt buộc — app phải chạy được với RPC công cộng. Mỗi hàm
 * dưới đây trả `undefined` khi thiếu, và tầng gọi có nhiệm vụ suy biến êm
 * (rơi về nguồn khác, hoặc nói rõ tính năng nào cần key gì).
 *
 * KHÔNG đặt secret ở đây: mọi giá trị VITE_* đều nằm trong bundle công khai.
 */

function readEnv(key: string): string | undefined {
  const value = import.meta.env[key as keyof ImportMetaEnv];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && !trimmed.includes('PLACEHOLDER') ? trimmed : undefined;
}

/** RPC ưu tiên + NFT API. Thiếu → RPC công cộng, NFT rơi về Etherscan. */
export const alchemyApiKey = () => readEnv('VITE_ALCHEMY_API_KEY');

/** Lịch sử + quét log Approval (Etherscan V2 — một key cho ETH/BSC/Polygon/Base/Sepolia). */
export const etherscanApiKey = () => readEnv('VITE_ETHERSCAN_API_KEY');

/** WalletConnect. Thiếu → chỉ ẩn connector đó, ví in-app và MetaMask vẫn chạy. */
export const walletConnectProjectId = () => readEnv('VITE_WC_PROJECT_ID');

// Base URL của backend đã có sẵn ở `src/config/env.ts` (API_BASE_URL) — dùng chỗ đó.
