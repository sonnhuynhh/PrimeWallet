import { useState } from 'react';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { Wallet, Smartphone, Puzzle, Check, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toastErr, toastOk } from '@/components/feedback/toast';
import { cn, shortAddress } from '@/lib/utils';

/**
 * Modal kết nối ví — bản tự viết thay cho RainbowKit.
 *
 * 3 nguồn ví:
 * - Ví trong ứng dụng (seed phrase, non-custodial) — mặc định, khuyên dùng
 * - Ví extension (MetaMask, Rabby…) qua connector `injected`
 * - Ví di động qua WalletConnect (chỉ hiện khi cấu hình VITE_WC_PROJECT_ID)
 */

const CONNECTOR_META: Record<string, { icon: React.ReactNode; description: string; badge?: string }> = {
  'in-app-wallet': {
    icon: <Wallet className="h-5 w-5" />,
    description: 'Ví seed phrase ngay trong PrimeWallet — khoá riêng tư không rời trình duyệt',
    badge: 'Khuyên dùng',
  },
  injected: {
    icon: <Puzzle className="h-5 w-5" />,
    description: 'MetaMask, Rabby hoặc tiện ích ví khác đã cài trên trình duyệt',
  },
  metaMask: {
    icon: <Puzzle className="h-5 w-5" />,
    description: 'Kết nối bằng tiện ích MetaMask',
  },
  walletConnect: {
    icon: <Smartphone className="h-5 w-5" />,
    description: 'Quét mã QR để kết nối ví trên điện thoại',
  },
};

interface ConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConnectModal({ isOpen, onClose }: ConnectModalProps) {
  const { connectors, connectAsync, isPending } = useConnect();
  const { address, isConnected, connector: activeConnector } = useAccount();
  const { disconnect } = useDisconnect();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleConnect = async (connectorId: string) => {
    const target = connectors.find((c) => c.id === connectorId);
    if (!target) return;

    setPendingId(connectorId);
    try {
      await connectAsync({ connector: target });
      toastOk('Đã kết nối ví', target.name);
      onClose();
    } catch (error) {
      toastErr(error, 'Không kết nối được ví');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kết nối ví" size="md">
      {isConnected ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Check className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-white">{activeConnector?.name ?? 'Đã kết nối'}</p>
                <p className="font-mono text-sm text-slate-400">{shortAddress(address, 10, 8)}</p>
              </div>
            </div>
          </div>

          <Button
            variant="danger"
            onClick={() => {
              disconnect();
              toastOk('Đã ngắt kết nối ví');
              onClose();
            }}
          >
            Ngắt kết nối
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {connectors.map((connector) => {
            const meta = CONNECTOR_META[connector.id] ?? {
              icon: <Wallet className="h-5 w-5" />,
              description: 'Kết nối bằng ví này',
            };
            const busy = pendingId === connector.id;

            return (
              <button
                key={connector.uid}
                type="button"
                disabled={isPending}
                onClick={() => handleConnect(connector.id)}
                className={cn(
                  'group flex w-full items-center gap-4 rounded-2xl border border-[--color-border] bg-white/[0.03] p-4 text-left transition-colors',
                  'hover:border-[--color-primary]/60 hover:bg-[--color-primary-soft]',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[--color-primary-soft] text-[--color-primary]">
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : meta.icon}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-white">{connector.name}</span>
                    {meta.badge ? (
                      <Badge variant="primary" className="text-[10px]">
                        {meta.badge}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-400">{meta.description}</span>
                </span>
              </button>
            );
          })}

          <p className="pt-2 text-center text-xs text-slate-500">
            PrimeWallet không bao giờ lưu hay gửi seed phrase của bạn lên máy chủ.
          </p>
        </div>
      )}
    </Modal>
  );
}
