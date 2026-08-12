import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";

import { chainIdOf, nativeSymbolOf, normalizeNetworkId, rpcOf } from "../lib/chains";
import { getPrivateKey, savePrivateKey } from "../storage/secureKeyStore";
import {
  getLinkedWallets,
  getSupportedNetworks,
  getWalletBalance,
  getWalletSupportedTokens,
  linkCryptoWallet,
  type CryptoWallet,
  type NetworkInfo,
  type WalletBalance,
} from "../services/crypto";
import type { TokenBalance } from "../types/crypto";

const ACTIVE_WALLET_KEY = "crypto_active_wallet_id";

export type SignTxParams = {
  to: string;
  data?: string;
  value?: bigint;
  gasLimit?: bigint;
};

export function useCryptoWallet() {
  const [networks, setNetworks] = useState<NetworkInfo[]>([]);
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [activeWallet, setActiveWallet] = useState<CryptoWallet | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [tokenRows, setTokenRows] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeNetwork = useMemo(() => {
    if (!activeWallet) return null;
    const id = normalizeNetworkId(activeWallet.blockchainNetwork);
    return networks.find((n) => normalizeNetworkId(n.id) === id) ?? null;
  }, [activeWallet, networks]);

  const chainId = activeNetwork?.chainId ?? (activeWallet ? chainIdOf(activeWallet.blockchainNetwork) : undefined);
  const address = activeWallet?.walletAddress;

  const buildTokenRows = (
    bal: WalletBalance | null,
    tokens: Awaited<ReturnType<typeof getWalletSupportedTokens>>,
    networkId: string,
    networkInfo: NetworkInfo | null,
  ) => {
    const nativeSymbol =
      networkInfo?.nativeSymbol ?? nativeSymbolOf(networkId) ?? bal?.nativeSymbol ?? "ETH";
    const native: TokenBalance = {
      symbol: nativeSymbol,
      name: "Native",
      decimals: 18,
      balance: String(bal?.balanceEth ?? "0"),
      isNative: true,
    };

    const balanceByContract = new Map<string, string>();
    for (const t of bal?.tokens ?? []) {
      if (!t?.contractAddress || t.isNative) continue;
      balanceByContract.set(t.contractAddress.toLowerCase(), String(t.balance ?? "0"));
    }

    const erc20: TokenBalance[] = tokens
      .filter((t) => t.contractAddress)
      .map((t) => ({
        contractAddress: t.contractAddress,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        balance: balanceByContract.get(t.contractAddress!.toLowerCase()) ?? "0",
      }));

    // Token có số dư từ backend nhưng không nằm trong danh sách supported
    for (const t of bal?.tokens ?? []) {
      if (!t?.contractAddress || t.isNative) continue;
      const key = t.contractAddress.toLowerCase();
      if (erc20.some((x) => x.contractAddress?.toLowerCase() === key)) continue;
      erc20.push({
        contractAddress: t.contractAddress,
        symbol: t.symbol,
        name: t.name ?? t.symbol,
        decimals: t.decimals ?? 18,
        balance: String(t.balance ?? "0"),
      });
    }

    return [native, ...erc20];
  };

  const refreshWalletData = async (wallet: CryptoWallet, nets = networks) => {
    setRefreshing(true);
    setError(null);
    try {
      const netId = normalizeNetworkId(wallet.blockchainNetwork);
      const networkInfo = nets.find((n) => normalizeNetworkId(n.id) === netId) ?? null;
      const [bal, toks] = await Promise.all([
        getWalletBalance(wallet.id),
        getWalletSupportedTokens(wallet.id).catch(() => []),
      ]);
      setBalance({ ...bal, nativeSymbol: networkInfo?.nativeSymbol ?? nativeSymbolOf(netId) });
      setTokenRows(buildTokenRows(bal, toks, netId, networkInfo));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được số dư");
    } finally {
      setRefreshing(false);
    }
  };

  const loadWallets = useCallback(async () => {
    setLoading(true);
    try {
      const [nets, linked] = await Promise.all([getSupportedNetworks(), getLinkedWallets()]);
      setNetworks(nets);
      setWallets(linked);

      const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
      const savedId = await AsyncStorage.getItem(ACTIVE_WALLET_KEY);
      const active = linked.find((w) => w.id === savedId) ?? linked[0] ?? null;
      setActiveWallet(active);
      if (active) await refreshWalletData(active, nets);
      else {
        setBalance(null);
        setTokenRows([]);
      }
    } catch {
      setWallets([]);
      setActiveWallet(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  const setActiveWalletId = async (walletId: string) => {
    const wallet = wallets.find((w) => w.id === walletId);
    if (!wallet) return;
    setActiveWallet(wallet);
    const { default: AsyncStorage } = await import("@react-native-async-storage/async-storage");
    await AsyncStorage.setItem(ACTIVE_WALLET_KEY, walletId);
    await refreshWalletData(wallet);
  };

  const selectWallet = async (wallet: CryptoWallet) => {
    await setActiveWalletId(wallet.id);
  };

  const loadBalance = async () => {
    if (activeWallet) await refreshWalletData(activeWallet);
  };

  const switchNetwork = async (networkId: string) => {
    if (!activeWallet) return;
    const normalized = normalizeNetworkId(networkId);
    if (normalizeNetworkId(activeWallet.blockchainNetwork) === normalized) return;

    const existing = wallets.find(
      (w) =>
        w.walletAddress.toLowerCase() === activeWallet.walletAddress.toLowerCase() &&
        normalizeNetworkId(w.blockchainNetwork) === normalized,
    );
    if (existing) {
      await setActiveWalletId(existing.id);
      return;
    }

    const linked = await linkCryptoWallet({
      walletAddress: activeWallet.walletAddress,
      blockchainNetwork: normalized,
      label: activeWallet.label,
    });
    await loadWallets();
    if (linked?.id) await setActiveWalletId(linked.id);
  };

  const signAndSend = async (params: SignTxParams): Promise<string> => {
    if (!activeWallet) throw new Error("Chưa có ví");
    const pk = await getPrivateKey();
    if (!pk) throw new Error("Không tìm thấy khóa ví trên thiết bị");

    const networkId = activeWallet.blockchainNetwork;
    const provider = new ethers.JsonRpcProvider(rpcOf(networkId, activeNetwork?.rpcUrl));
    const wallet = new ethers.Wallet(pk, provider);
    const tx = await wallet.populateTransaction({
      to: params.to,
      data: params.data ?? "0x",
      value: params.value ?? 0n,
      gasLimit: params.gasLimit,
    });
    const signed = await wallet.signTransaction(tx);
    const { broadcastTransaction } = await import("../services/crypto");
    const res = await broadcastTransaction(signed, normalizeNetworkId(networkId));
    return res.transactionHash;
  };

  const signAndSendNative = async (to: string, amountEth: string) => {
    return signAndSend({ to: to.trim(), value: ethers.parseEther(amountEth) });
  };

  const signErc20Transfer = async (tokenAddress: string, to: string, amount: string, decimals: number) => {
    const iface = new ethers.Interface(["function transfer(address to, uint256 value) returns (bool)"]);
    const data = iface.encodeFunctionData("transfer", [to.trim(), ethers.parseUnits(amount, decimals)]);
    return signAndSend({ to: tokenAddress, data });
  };

  return {
    networks,
    wallets,
    activeWallet,
    activeNetwork,
    balance,
    tokens: tokenRows,
    tokenRows,
    chainId,
    address,
    loading,
    refreshing,
    error,
    reload: loadWallets,
    loadWallets,
    loadBalance,
    selectWallet,
    setActiveWalletId,
    switchNetwork,
    signAndSend,
    signAndSendNative,
    signErc20Transfer,
    savePrivateKey,
  };
}
