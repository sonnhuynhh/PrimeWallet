import { useCallback, useEffect, useState } from 'react';
import {
  getSupportedNetworks,
  getLinkedWallets,
  getWalletBalance,
} from '../../../services/crypto';
import type {
  NetworkInfo,
  CryptoWalletInfo,
  WalletBalanceData,
  TokenBalance,
} from '../../../types/crypto';

/**
 * Tầng dữ liệu ví crypto: mạng, danh sách ví đã liên kết, số dư ví đang chọn.
 *
 * Tách khỏi component để 8 tab dùng chung một nguồn — trước đây mọi state nằm
 * trong CryptoShell nên thêm tab nào cũng phải truyền props xuống.
 */

export interface CryptoWalletData {
  networks: NetworkInfo[];
  wallets: CryptoWalletInfo[];
  activeWalletId: string | null;
  setActiveWalletId: (id: string | null) => void;
  activeWallet: CryptoWalletInfo | null;
  activeNetwork: NetworkInfo | null;
  balance: WalletBalanceData | null;
  /** Native coin + ERC-20 gộp thành một danh sách cho bảng tài sản. */
  tokenRows: (TokenBalance & { isNative?: boolean })[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  loadWallets: () => Promise<CryptoWalletInfo[]>;
  loadBalance: () => Promise<void>;
}

export function useCryptoWalletData(): CryptoWalletData {
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [wallets, setWallets] = useState<CryptoWalletInfo[]>([]);
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  const [balance, setBalance] = useState<WalletBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNetworks = useCallback(async () => {
    try {
      setNetworks(await getSupportedNetworks());
    } catch (e) {
      console.warn('Không tải được mạng', e);
    }
  }, []);

  const loadWallets = useCallback(async () => {
    try {
      const data = await getLinkedWallets();
      setWallets(data);
      // Giữ ví đang chọn nếu còn tồn tại, ngược lại chọn ví primary đầu tiên.
      setActiveWalletId((prev) => {
        if (prev && data.some((w) => w.id === prev)) return prev;
        return data.find((w) => w.primary)?.id ?? data[0]?.id ?? null;
      });
      return data;
    } catch (e) {
      console.warn('Không tải được ví', e);
      return [];
    }
  }, []);

  const loadBalance = useCallback(async () => {
    if (!activeWalletId) return;
    try {
      setRefreshing(true);
      setBalance(await getWalletBalance(activeWalletId));
    } catch (e) {
      setError('Không tải được số dư ví: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRefreshing(false);
    }
  }, [activeWalletId]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await Promise.all([loadNetworks(), loadWallets()]);
      setLoading(false);
    })();
  }, [loadNetworks, loadWallets]);

  useEffect(() => {
    if (activeWalletId) void loadBalance();
  }, [activeWalletId, loadBalance]);

  const activeWallet = wallets.find((w) => w.id === activeWalletId) ?? null;
  const activeNetwork = networks.find((n) => n.id === activeWallet?.blockchainNetwork) ?? null;

  const tokenRows: (TokenBalance & { isNative?: boolean })[] = balance
    ? [
        {
          symbol: balance.nativeSymbol,
          name: balance.networkLabel || 'Native coin',
          decimals: 18,
          balance: balance.balanceEth,
          isNative: true,
        },
        ...(balance.tokens ?? []),
      ]
    : [];

  return {
    networks,
    wallets,
    activeWalletId,
    setActiveWalletId,
    activeWallet,
    activeNetwork,
    balance,
    tokenRows,
    loading,
    refreshing,
    error,
    setError,
    loadWallets,
    loadBalance,
  };
}
