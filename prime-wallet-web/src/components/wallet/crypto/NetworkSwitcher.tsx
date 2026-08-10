import { useEffect, useRef, useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { NetworkIcon } from '@/components/ui/NetworkIcon';
import { toastErr, toastOk } from '@/components/feedback/toast';
import { cn } from '@/lib/utils';
import { linkCryptoWallet } from '@/services/crypto';
import { useCrypto } from './CryptoContext';

/**
 * Nút đổi mạng cho ví đang chọn.
 *
 * Ví được liên kết theo cặp (địa chỉ, mạng) nên "đổi mạng" nghĩa là:
 * - Ví ngoài (OKX, MetaMask…): yêu cầu extension đổi chain qua
 *   `wallet_switchEthereumChain`; useExternalWalletLink sẽ tự liên kết + chọn
 *   ví trên mạng mới.
 * - Ví in-app: nếu địa chỉ đã liên kết trên mạng đích thì chọn luôn; chưa có
 *   thì liên kết thêm trên mạng đó.
 *
 * KHÔNG ký lại khi đổi mạng: quyền sở hữu địa chỉ đã được chứng minh một lần
 * lúc liên kết đầu tiên — mạng chỉ là metadata, cùng địa chỉ trên mọi chain EVM.
 */
export function NetworkSwitcher() {
  const { data } = useCrypto();
  const { networks, wallets, activeWallet, activeNetwork, loadWallets, setActiveWalletId } = data;
  const { address: externalAddress, isConnected, connector } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!activeWallet || networks.length === 0) return null;

  // Ví đang chọn có đang là phiên ví ngoài không — quyết định cách đổi mạng.
  const isExternalActive =
    isConnected &&
    connector?.id !== 'in-app-wallet' &&
    externalAddress?.toLowerCase() === activeWallet.walletAddress.toLowerCase();

  const handleSelect = async (networkId: string) => {
    setOpen(false);
    if (networkId === activeWallet.blockchainNetwork || busyId) return;
    const network = networks.find((n) => n.id === networkId);
    if (!network) return;

    setBusyId(networkId);
    try {
      if (isExternalActive) {
        await switchChainAsync({ chainId: network.chainId });
        toastOk('Đã đổi mạng', network.label);
        return;
      }

      const existing = wallets.find(
        (w) =>
          w.walletAddress.toLowerCase() === activeWallet.walletAddress.toLowerCase() &&
          w.blockchainNetwork === networkId,
      );
      if (existing) {
        setActiveWalletId(existing.id);
        toastOk('Đã đổi mạng', network.label);
        return;
      }

      // Địa chỉ chưa liên kết trên mạng đích → liên kết thêm, không cần ký lại
      // (đã chứng minh sở hữu địa chỉ này khi liên kết lần đầu).
      const saved = await linkCryptoWallet({
        walletAddress: activeWallet.walletAddress,
        blockchainNetwork: networkId,
        label: activeWallet.label ?? undefined,
      });

      await loadWallets();
      if (saved?.id) setActiveWalletId(saved.id);
      toastOk('Đã đổi mạng', `${network.label} — ví đã được liên kết thêm trên mạng này.`);
    } catch (error) {
      toastErr(error, 'Không đổi được mạng');
    } finally {
      setBusyId(null);
    }
  };

  const label = activeNetwork?.label ?? activeWallet.blockchainNetwork;

  return (
    <div ref={rootRef} className="relative w-full shrink-0 sm:w-auto">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-full border border-[--color-border] bg-black/35 px-3.5 py-2.5 backdrop-blur-xl sm:w-auto sm:justify-start sm:px-4',
          'text-sm font-semibold text-white transition-colors hover:border-[--color-primary]/50',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {busyId ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[--color-primary]" />
          ) : (
            <NetworkIcon networkId={activeWallet.blockchainNetwork} size={20} />
          )}
          <span className="truncate sm:max-w-40">{label}</span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[--color-muted-foreground] transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Chọn mạng blockchain"
          className="absolute right-0 z-40 mt-2 w-full min-w-[16rem] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-3xl border border-[--color-border] bg-[#1b1b1b]/95 p-1.5 shadow-[0_24px_80px_-30px_rgba(252,114,255,0.45)] backdrop-blur-xl sm:w-64"
        >
          {networks.map((network) => {
            const current = network.id === activeWallet.blockchainNetwork;
            const busy = busyId === network.id;

            return (
              <li key={network.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={current}
                  disabled={Boolean(busyId)}
                  onClick={() => void handleSelect(network.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                    current
                      ? 'bg-[--color-primary-soft] text-white'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  <NetworkIcon networkId={network.id} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{network.label}</span>
                      {network.testnet ? (
                        <Badge variant="warning" className="text-[10px]">
                          Testnet
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-xs text-slate-500">{network.nativeSymbol}</span>
                  </span>
                  {busy ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[--color-primary]" />
                  ) : current ? (
                    <Check className="h-4 w-4 shrink-0 text-[--color-primary]" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
