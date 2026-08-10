import { useCallback, useEffect, useRef, useState } from "react";
import { EthereumProvider } from "@walletconnect/ethereum-provider";

import { WALLETCONNECT_PROJECT_ID } from "../config/env";
import { chainIdOf } from "../lib/chains";

const SUPPORTED_CHAINS = [1, 11155111, 56, 137, 8453] as const;

type WcProvider = Awaited<ReturnType<typeof EthereumProvider.init>>;

let sharedProvider: WcProvider | null = null;

async function getProvider(chainId: number): Promise<WcProvider> {
  if (!WALLETCONNECT_PROJECT_ID) {
    throw new Error("Chưa cấu hình EXPO_PUBLIC_WC_PROJECT_ID trong .env");
  }
  if (sharedProvider) return sharedProvider;

  const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
  sharedProvider = await EthereumProvider.init({
    projectId: WALLETCONNECT_PROJECT_ID,
    showQrModal: true,
    chains: [chainId],
    optionalChains: [...SUPPORTED_CHAINS],
    metadata: {
      name: "PrimeWallet",
      description: "Ví đa tài sản Fiat & Crypto",
      url: "https://primewallet.app",
      icons: ["https://primewallet.app/icon.png"],
    },
  });
  return sharedProvider;
}

export type ExternalSendParams = {
  to: string;
  data?: string;
  value?: bigint;
  gas?: bigint;
};

export function useExternalWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [peerName, setPeerName] = useState<string | null>(null);
  const providerRef = useRef<WcProvider | null>(null);

  const syncFromProvider = useCallback((provider: WcProvider) => {
    const accounts = provider.accounts;
    setAddress(accounts[0] ?? null);
    setChainId(provider.chainId);
    setIsConnected(accounts.length > 0);
    const session = provider.session;
    setPeerName(session?.peer?.metadata?.name ?? "WalletConnect");
  }, []);

  useEffect(() => {
    const provider = providerRef.current ?? sharedProvider;
    if (!provider) return;

    const onAccounts = (accounts: string[]) => {
      setAddress(accounts[0] ?? null);
      setIsConnected(accounts.length > 0);
    };
    const onChain = (id: string | number) => setChainId(Number(id));
    const onDisconnect = () => {
      setAddress(null);
      setChainId(null);
      setIsConnected(false);
      setPeerName(null);
    };

    provider.on("accountsChanged", onAccounts);
    provider.on("chainChanged", onChain);
    provider.on("disconnect", onDisconnect);
    syncFromProvider(provider);

    return () => {
      provider.removeListener("accountsChanged", onAccounts);
      provider.removeListener("chainChanged", onChain);
      provider.removeListener("disconnect", onDisconnect);
    };
  }, [syncFromProvider, isConnected]);

  const connect = useCallback(async (networkId?: string) => {
    const targetChain = networkId ? chainIdOf(networkId) : 11155111;
    setIsConnecting(true);
    try {
      const provider = await getProvider(targetChain);
      providerRef.current = provider;
      if (!provider.connected) {
        await provider.connect();
      } else if (provider.chainId !== targetChain) {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${targetChain.toString(16)}` }],
        });
      }
      syncFromProvider(provider);
    } finally {
      setIsConnecting(false);
    }
  }, [syncFromProvider]);

  const disconnect = useCallback(async () => {
    const provider = providerRef.current ?? sharedProvider;
    if (provider?.connected) {
      await provider.disconnect();
    }
    sharedProvider = null;
    providerRef.current = null;
    setAddress(null);
    setChainId(null);
    setIsConnected(false);
    setPeerName(null);
  }, []);

  const signMessage = useCallback(async (message: string) => {
    const provider = providerRef.current ?? sharedProvider;
    if (!provider || !address) throw new Error("Chưa kết nối ví ngoài");
    return provider.request<string>({
      method: "personal_sign",
      params: [message, address],
    });
  }, [address]);

  const sendTransaction = useCallback(async (params: ExternalSendParams) => {
    const provider = providerRef.current ?? sharedProvider;
    if (!provider || !address) throw new Error("Chưa kết nối ví ngoài");

    const tx: Record<string, string> = {
      from: address,
      to: params.to,
      data: params.data ?? "0x",
      value: `0x${(params.value ?? 0n).toString(16)}`,
    };
    if (params.gas) tx.gas = `0x${params.gas.toString(16)}`;

    return provider.request<string>({
      method: "eth_sendTransaction",
      params: [tx],
    });
  }, [address]);

  return {
    provider: providerRef.current ?? sharedProvider,
    address,
    chainId,
    isConnected,
    isConnecting,
    peerName,
    connect,
    disconnect,
    signMessage,
    sendTransaction,
    walletConnectEnabled: Boolean(WALLETCONNECT_PROJECT_ID),
  };
}
