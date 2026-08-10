import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAccount, useDisconnect } from 'wagmi';
import {
  Wallet, Plus, Link2, Trash2, Star, Copy, Check, ShieldCheck, Puzzle, Unplug,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { toastErr, toastOk } from '@/components/feedback/toast';
import { cn, shortAddress } from '@/lib/utils';
import { unlinkCryptoWallet } from '@/services/crypto';
import { clearSessionSeed, isSessionUnlocked } from '@/services/seedStore';
import { useCrypto } from '../CryptoContext';

/**
 * Tab "Ví" — quản lý các ví đã liên kết với tài khoản.
 *
 * Server chỉ giữ địa chỉ công khai, nên "xóa ví" ở đây là bỏ liên kết chứ không
 * ảnh hưởng gì tới tài sản on-chain. Nói rõ điều đó trong phần xác nhận.
 */
export function WalletTab({ onConnectExternal }: { onConnectExternal: () => void }) {
  const { data, openLink } = useCrypto();
  const { wallets, activeWalletId, setActiveWalletId, networks, loadWallets } = data;
  const { address: externalAddress, isConnected, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const [copied, setCopied] = useState<string | null>(null);
  const [confirm, confirmDialogEl] = useConfirm();

  const isExternalConnector = isConnected && connector?.id !== 'in-app-wallet';

  const copy = async (address: string) => {
    await navigator.clipboard.writeText(address);
    setCopied(address);
    toastOk('Đã copy địa chỉ ví');
    window.setTimeout(() => setCopied(null), 1600);
  };

  const handleUnlink = async (id: string, address: string) => {
    const ok = await confirm({
      title: 'Bỏ liên kết ví?',
      message:
        'Ví sẽ không còn hiện trong tài khoản PrimeWallet. Tài sản on-chain KHÔNG bị ảnh hưởng — ' +
        'bạn vẫn khôi phục được bằng seed phrase đã sao lưu.',
      confirmText: 'Bỏ liên kết',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await unlinkCryptoWallet(id);
      clearSessionSeed(address);
      await loadWallets();
      if (activeWalletId === id) setActiveWalletId(null);
      toastOk('Đã bỏ liên kết ví');
    } catch (error) {
      toastErr(error, 'Không bỏ liên kết được ví');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
        <Button onClick={() => openLink('create')}>
          <Plus className="h-4 w-4" /> Tạo ví mới
        </Button>
        <Button variant="secondary" onClick={() => openLink('link')}>
          <Link2 className="h-4 w-4" /> Liên kết ví có sẵn
        </Button>
        <Button variant="secondary" onClick={onConnectExternal}>
          <Puzzle className="h-4 w-4" /> Kết nối ví ngoài
        </Button>
      </div>

      {isExternalConnector ? (
        <Card className="border-[--color-primary]/40 bg-[--color-primary-soft]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[--color-primary]/20 text-[--color-primary]">
                <Puzzle className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-white">{connector?.name} đang kết nối</p>
                <p className="font-mono text-sm text-slate-400">{shortAddress(externalAddress, 10, 8)}</p>
              </div>
            </div>
            <Button
              fullWidth={false}
              variant="secondary"
              onClick={() => {
                disconnect();
                toastOk('Đã ngắt kết nối ví ngoài');
              }}
            >
              <Unplug className="h-4 w-4" /> Ngắt kết nối
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white">
          <Wallet className="h-5 w-5 text-[--color-primary]" /> Ví đã liên kết
        </h3>
        <p className="mb-5 text-sm text-slate-400">
          PrimeWallet chỉ lưu địa chỉ công khai. Seed phrase nằm trong trình duyệt của bạn và mất khi đóng tab.
        </p>

        {wallets.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Chưa có ví nào. Tạo ví mới hoặc liên kết ví có sẵn để bắt đầu.
          </p>
        ) : (
          <ul className="space-y-3">
            {wallets.map((wallet) => {
              const network = networks.find((n) => n.id === wallet.blockchainNetwork);
              const active = wallet.id === activeWalletId;
              const unlocked = isSessionUnlocked(wallet.walletAddress);

              return (
                <li
                  key={wallet.id}
                  className={cn(
                    'rounded-2xl border p-4 transition-colors',
                    active
                      ? 'border-[--color-primary]/60 bg-[--color-primary-soft]'
                      : 'border-[--color-border] bg-white/3 hover:border-[--color-primary]/40',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveWalletId(wallet.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">
                          {wallet.label?.trim() || 'Ví không tên'}
                        </span>
                        {wallet.primary ? (
                          <Badge variant="primary">
                            <Star className="h-3 w-3" /> Chính
                          </Badge>
                        ) : null}
                        {active ? <Badge variant="primary">Đang chọn</Badge> : null}
                        {unlocked ? (
                          <Badge variant="success">
                            <ShieldCheck className="h-3 w-3" /> Đã mở khóa
                          </Badge>
                        ) : (
                          <Badge variant="outline">Nhập seed một lần / phiên</Badge>
                        )}
                      </span>
                      <span className="mt-1 block font-mono text-sm text-slate-400">
                        {shortAddress(wallet.walletAddress, 12, 10)}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {network?.label ?? wallet.blockchainNetwork}
                      </span>
                    </button>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        title="Copy địa chỉ"
                        onClick={() => void copy(wallet.walletAddress)}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-[--color-border] text-slate-400 transition-colors hover:border-[--color-primary]/60 hover:text-white"
                      >
                        {copied === wallet.walletAddress ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        title="Bỏ liên kết ví"
                        onClick={() => void handleUnlink(wallet.id, wallet.walletAddress)}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-[--color-border] text-slate-400 transition-colors hover:border-red-500/60 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {confirmDialogEl}
    </motion.div>
  );
}
