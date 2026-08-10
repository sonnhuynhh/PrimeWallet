import { createConfig, http, injected } from 'wagmi';
import { walletConnect } from 'wagmi/connectors';
import type { Address } from 'viem';
import { walletConnectProjectId } from '@/lib/env';
import { SUPPORTED_CHAINS, FALLBACK_RPC, type NetworkId } from './chains';
import { inAppConnector } from './inAppConnector';

/**
 * Cấu hình wagmi cho PrimeWallet.
 *
 * 3 connector:
 * 1. `in-app-wallet` — ví seed phrase trong ứng dụng (non-custodial, mặc định)
 * 2. `injected`      — MetaMask / Rabby / ví extension khác
 * 3. `walletConnect` — ví mobile (chỉ bật khi có VITE_WC_PROJECT_ID)
 *
 * RPC lấy từ backend qua `/networks`; bảng FALLBACK_RPC chỉ dùng khi thiếu.
 */

/** projectId của WalletConnect Cloud — KHÔNG commit, đọc từ .env.local. */
const WC_PROJECT_ID = walletConnectProjectId();

export const hasWalletConnect = Boolean(WC_PROJECT_ID);

interface BuildConfigParams {
  /** Địa chỉ ví in-app đang chọn. */
  getInAppAddress: () => Address | undefined;
  /** chainId đang active. */
  getChainId: () => number | undefined;
  /** Mở modal nhập seed; trả seed hoặc null nếu user huỷ. */
  requestUnlock: (address: Address) => Promise<string | null>;
  /** RPC override theo mạng đang active (từ backend). */
  getRpcUrl?: () => string | undefined;
  /** RPC override cho từng mạng (từ `GET /networks`). */
  rpcOverrides?: Partial<Record<NetworkId, string>>;
}

export function buildWagmiConfig(params: BuildConfigParams) {
  const overrides = params.rpcOverrides ?? {};

  const connectors = [
    inAppConnector({
      address: params.getInAppAddress,
      chainId: params.getChainId,
      onUnlockRequired: params.requestUnlock,
      rpcUrl: params.getRpcUrl,
    }),
    injected({ shimDisconnect: true }),
    ...(WC_PROJECT_ID
      ? [
          walletConnect({
            projectId: WC_PROJECT_ID,
            showQrModal: true,
            metadata: {
              name: 'PrimeWallet',
              description: 'Ví tiền số & tiền pháp định phi lưu ký',
              url: window.location.origin,
              icons: [`${window.location.origin}/favicon.ico`],
            },
          }),
        ]
      : []),
  ];

  return createConfig({
    chains: SUPPORTED_CHAINS,
    connectors,
    transports: {
      1: http(overrides.eth_mainnet ?? FALLBACK_RPC.eth_mainnet),
      11155111: http(overrides.eth_sepolia ?? FALLBACK_RPC.eth_sepolia),
      56: http(overrides.bsc_mainnet ?? FALLBACK_RPC.bsc_mainnet),
      137: http(overrides.polygon_mainnet ?? FALLBACK_RPC.polygon_mainnet),
      8453: http(overrides.base_mainnet ?? FALLBACK_RPC.base_mainnet),
    },
    // Ví in-app không được tự kết nối lại: seed đã mất khi đóng tab,
    // nên reconnect sẽ luôn bật modal nhập seed gây khó chịu.
    multiInjectedProviderDiscovery: true,
    ssr: false,
  });
}

export type PrimeWagmiConfig = ReturnType<typeof buildWagmiConfig>;
