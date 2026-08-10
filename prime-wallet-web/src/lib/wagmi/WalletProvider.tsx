import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Address } from 'viem';
import { buildWagmiConfig, type PrimeWagmiConfig } from './config';

/**
 * Gắn wagmi + React Query vào cây React.
 *
 * Vấn đề cần giải: `createConfig` chỉ chạy một lần, nhưng ví in-app đang chọn,
 * chainId và hàm mở khóa seed lại thay đổi theo thao tác người dùng. Nên config
 * đọc qua ref — closure ổn định, giá trị luôn mới, không phải dựng lại config
 * (dựng lại sẽ ngắt mọi kết nối MetaMask/WalletConnect đang mở).
 */

interface WalletBridge {
  /** CryptoShell gọi khi đổi ví/mạng đang chọn. */
  syncInApp: (params: { address?: Address; chainId?: number; rpcUrl?: string }) => void;
  /** CryptoShell đăng ký hàm mở modal nhập seed; trả seed hoặc null nếu huỷ. */
  registerUnlockHandler: (handler: (address: Address) => Promise<string | null>) => void;
  config: PrimeWagmiConfig;
}

const WalletBridgeContext = createContext<WalletBridge | null>(null);

export function useWalletBridge(): WalletBridge {
  const ctx = useContext(WalletBridgeContext);
  if (!ctx) throw new Error('useWalletBridge phải nằm trong <WalletProvider>');
  return ctx;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dữ liệu on-chain cũ đi rất nhanh; 15s là mức cân bằng giữa
      // số lần gọi RPC và độ tươi của số dư.
      staleTime: 15_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const inAppRef = useRef<{ address?: Address; chainId?: number; rpcUrl?: string }>({});
  const unlockRef = useRef<((address: Address) => Promise<string | null>) | null>(null);

  const syncInApp = useCallback((params: { address?: Address; chainId?: number; rpcUrl?: string }) => {
    inAppRef.current = { ...inAppRef.current, ...params };
  }, []);

  const registerUnlockHandler = useCallback(
    (handler: (address: Address) => Promise<string | null>) => {
      unlockRef.current = handler;
    },
    [],
  );

  // Config dựng đúng một lần — mọi thứ động đều đi qua ref ở trên.
  const [config] = useState<PrimeWagmiConfig>(() =>
    buildWagmiConfig({
      getInAppAddress: () => inAppRef.current.address,
      getChainId: () => inAppRef.current.chainId,
      getRpcUrl: () => inAppRef.current.rpcUrl,
      requestUnlock: async (address) => {
        // Chưa có shell nào đăng ký handler → coi như người dùng không mở khóa được.
        if (!unlockRef.current) return null;
        return unlockRef.current(address);
      },
    }),
  );

  const bridge = useMemo<WalletBridge>(
    () => ({ syncInApp, registerUnlockHandler, config }),
    [syncInApp, registerUnlockHandler, config],
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WalletBridgeContext.Provider value={bridge}>{children}</WalletBridgeContext.Provider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
