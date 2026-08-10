import { useCallback, useEffect, useRef } from "react";

import {
  createOwnershipChallenge,
  linkCryptoWallet,
  linkCryptoWalletWithProof,
  type CryptoWallet,
} from "../services/crypto";
import { networkIdOf, normalizeNetworkId } from "../lib/chains";
import { toastErr, toastOk } from "../components/feedback/toast";
import type { useExternalWallet } from "./useExternalWallet";

type ExternalWallet = ReturnType<typeof useExternalWallet>;

interface AutoLinkParams {
  wallets: CryptoWallet[];
  loadWallets: () => Promise<void>;
  setActiveWalletId: (walletId: string) => Promise<void>;
  ready: boolean;
  external: ExternalWallet;
}

export function useExternalWalletLink({
  wallets,
  loadWallets,
  setActiveWalletId,
  ready,
  external,
}: AutoLinkParams) {
  const attempted = useRef<Set<string>>(new Set());

  const linkExternal = useCallback(
    async (target: string, targetChainId: number, alreadyProven: boolean) => {
      const networkId = normalizeNetworkId(networkIdOf(targetChainId));
      const key = `${target.toLowerCase()}:${networkId}`;
      if (attempted.current.has(key)) return;
      attempted.current.add(key);

      try {
        let saved;
        if (alreadyProven) {
          saved = await linkCryptoWallet({
            walletAddress: target,
            blockchainNetwork: networkId,
            label: external.peerName ? `Ví ${external.peerName}` : undefined,
          });
        } else {
          const challenge = await createOwnershipChallenge(target);
          const signature = await external.signMessage(challenge.message);
          saved = await linkCryptoWalletWithProof({
            walletAddress: target,
            blockchainNetwork: networkId,
            label: external.peerName ? `Ví ${external.peerName}` : undefined,
            message: challenge.message,
            signature,
          });
        }

        await loadWallets();
        if (saved?.id) await setActiveWalletId(saved.id);
        toastOk("Đã liên kết ví ngoài", `${external.peerName ?? "WC"} · ${target.slice(0, 10)}…`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/rejected|denied|User rejected/i.test(message)) {
          attempted.current.delete(key);
          return;
        }
        toastErr(error, "Không liên kết được ví ngoài");
      }
    },
    [external, loadWallets, setActiveWalletId],
  );

  useEffect(() => {
    if (!ready || !external.isConnected || !external.address || !external.chainId) return;

    const networkId = normalizeNetworkId(networkIdOf(external.chainId));

    const sameAddress = wallets.filter(
      (w) => w.walletAddress.toLowerCase() === external.address!.toLowerCase(),
    );
    const already = sameAddress.find((w) => normalizeNetworkId(w.blockchainNetwork) === networkId);

    if (already) {
      void setActiveWalletId(already.id);
      return;
    }

    void linkExternal(external.address, external.chainId, sameAddress.length > 0);
  }, [
    ready,
    external.isConnected,
    external.address,
    external.chainId,
    wallets,
    linkExternal,
    setActiveWalletId,
  ]);
}
