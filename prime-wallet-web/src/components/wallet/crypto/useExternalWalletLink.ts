import { useCallback, useEffect, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import type { Address } from 'viem';
import { createOwnershipChallenge, linkCryptoWallet, linkCryptoWalletWithProof } from '@/services/crypto';
import { networkIdOf } from '@/lib/wagmi/chains';
import { toastErr, toastOk } from '@/components/feedback/toast';
import type { CryptoWalletInfo } from '@/types/crypto';

/**
 * Tự liên kết ví ngoài (OKX, MetaMask, WalletConnect…) vào tài khoản sau khi kết nối.
 *
 * Vì sao cần: kết nối wagmi chỉ tạo phiên phía trình duyệt, còn danh sách ví của
 * các tab lại đọc từ backend (`GET /crypto/wallets`). Thiếu bước này, người dùng
 * kết nối OKX xong sang tab Tài sản vẫn thấy "Chưa có ví Crypto" vì backend chưa
 * hề biết địa chỉ đó.
 *
 * Vẫn đúng mô hình non-custodial: ví ngoài ký challenge bằng `personal_sign`,
 * server recover địa chỉ từ chữ ký — khoá riêng tư không rời extension.
 */

interface AutoLinkParams {
  /** Ví đã liên kết ở backend — để biết địa chỉ nào cần link. */
  wallets: CryptoWalletInfo[];
  /** Tải lại danh sách ví sau khi link. */
  loadWallets: () => Promise<CryptoWalletInfo[]>;
  /** Chọn ví vừa link làm ví đang xem. */
  setActiveWalletId: (id: string | null) => void;
  /** Chỉ chạy khi dữ liệu ví đã tải xong, tránh link trùng lúc danh sách còn rỗng. */
  ready: boolean;
}

export function useExternalWalletLink({
  wallets,
  loadWallets,
  setActiveWalletId,
  ready,
}: AutoLinkParams) {
  const { address, isConnected, connector, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // Mỗi cặp (địa chỉ, mạng) chỉ thử link một lần cho mỗi phiên: người dùng có thể
  // từ chối ký, và thử lại vô hạn sẽ dội modal ký liên tục.
  const attempted = useRef<Set<string>>(new Set());

  const linkExternal = useCallback(
    async (target: Address, targetChainId: number, alreadyProven: boolean) => {
      const networkId = networkIdOf(targetChainId);
      const key = `${target.toLowerCase()}:${networkId}`;
      if (attempted.current.has(key)) return;
      attempted.current.add(key);

      try {
        let saved;
        if (alreadyProven) {
          // Địa chỉ đã chứng minh sở hữu (đã liên kết trên mạng khác) → đổi mạng
          // không cần ký lại, chỉ liên kết thêm cặp (địa chỉ, mạng mới).
          saved = await linkCryptoWallet({
            walletAddress: target,
            blockchainNetwork: networkId,
            label: connector?.name ? `Ví ${connector.name}` : undefined,
          });
        } else {
          // Lần đầu thấy địa chỉ này → ký challenge đúng MỘT lần để chứng minh sở hữu.
          const challenge = await createOwnershipChallenge(target);
          const signature = await signMessageAsync({
            account: target,
            message: challenge.message,
          });

          saved = await linkCryptoWalletWithProof({
            walletAddress: target,
            blockchainNetwork: networkId,
            label: connector?.name ? `Ví ${connector.name}` : undefined,
            message: challenge.message,
            signature,
          });
        }

        await loadWallets();
        if (saved?.id) setActiveWalletId(saved.id);
        toastOk('Đã liên kết ví ngoài', `${connector?.name ?? 'Ví'} · ${target.slice(0, 10)}…`);
      } catch (error) {
        // Người dùng từ chối ký là lựa chọn hợp lệ, không phải lỗi cần báo đỏ.
        const message = error instanceof Error ? error.message : String(error);
        if (/rejected|denied|User rejected/i.test(message)) {
          attempted.current.delete(key);
          return;
        }
        toastErr(error, 'Không liên kết được ví ngoài');
      }
    },
    [connector?.name, loadWallets, setActiveWalletId, signMessageAsync],
  );

  useEffect(() => {
    if (!ready || !isConnected || !address || !chainId) return;
    // Ví in-app đã tự link lúc tạo/liên kết — chỉ xử lý ví ngoài.
    if (connector?.id === 'in-app-wallet') return;

    const networkId = networkIdOf(chainId);
    const sameAddress = wallets.filter(
      (w) => w.walletAddress.toLowerCase() === address.toLowerCase(),
    );
    const already = sameAddress.find((w) => w.blockchainNetwork === networkId);

    if (already) {
      setActiveWalletId(already.id);
      return;
    }

    // Địa chỉ từng liên kết trên mạng khác = đã chứng minh sở hữu → khỏi ký lại.
    void linkExternal(address, chainId, sameAddress.length > 0);
  }, [ready, isConnected, address, chainId, connector?.id, wallets, linkExternal, setActiveWalletId]);
}
