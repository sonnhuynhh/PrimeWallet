import { useCallback, useMemo, createContext, useContext, type ReactNode } from "react";

import { useCryptoWallet } from "../hooks/useCryptoWallet";
import { useExternalWallet } from "../hooks/useExternalWallet";
import { useExternalWalletLink } from "../hooks/useExternalWalletLink";
import type { SignTxParams } from "../hooks/useCryptoWallet";

type CryptoWalletValue = ReturnType<typeof useCryptoWallet>;
type ExternalWalletValue = ReturnType<typeof useExternalWallet>;

export type CryptoContextValue = CryptoWalletValue & {
  externalAddress: string | null;
  wcChainId: number | null;
  isWcConnected: boolean;
  isWcConnecting: boolean;
  peerName: string | null;
  usesWalletClient: boolean;
  walletConnectEnabled: boolean;
  connectExternal: (networkId?: string) => Promise<void>;
  disconnectExternal: () => Promise<void>;
  signMessageExternal: (message: string) => Promise<string>;
  signAndSend: (params: SignTxParams) => Promise<string>;
};

const CryptoContext = createContext<CryptoContextValue | null>(null);

export function CryptoProvider({ children }: { children: ReactNode }) {
  const wallet = useCryptoWallet();
  const external = useExternalWallet();

  useExternalWalletLink({
    wallets: wallet.wallets,
    loadWallets: wallet.loadWallets,
    setActiveWalletId: wallet.setActiveWalletId,
    ready: !wallet.loading,
    external,
  });

  const usesWalletClient = useMemo(
    () =>
      Boolean(
        external.isConnected &&
          external.address &&
          wallet.activeWallet?.walletAddress.toLowerCase() === external.address.toLowerCase(),
      ),
    [external.isConnected, external.address, wallet.activeWallet?.walletAddress],
  );

  const signAndSend = useCallback(
    async (params: SignTxParams) => {
      if (usesWalletClient) {
        return external.sendTransaction({
          to: params.to,
          data: params.data,
          value: params.value,
          gas: params.gasLimit,
        });
      }
      return wallet.signAndSend(params);
    },
    [usesWalletClient, external, wallet],
  );

  const value: CryptoContextValue = {
    ...wallet,
    externalAddress: external.address,
    wcChainId: external.chainId,
    isWcConnected: external.isConnected,
    isWcConnecting: external.isConnecting,
    peerName: external.peerName,
    usesWalletClient,
    walletConnectEnabled: external.walletConnectEnabled,
    connectExternal: external.connect,
    disconnectExternal: external.disconnect,
    signMessageExternal: external.signMessage,
    signAndSend,
  };

  return <CryptoContext.Provider value={value}>{children}</CryptoContext.Provider>;
}

export function useCrypto() {
  const ctx = useContext(CryptoContext);
  if (!ctx) throw new Error("useCrypto must be used within CryptoProvider");
  return ctx;
}
