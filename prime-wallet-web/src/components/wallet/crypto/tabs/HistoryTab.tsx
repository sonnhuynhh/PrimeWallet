import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { formatEther } from 'viem';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
  WifiOff,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { toastErr } from '@/components/feedback/toast';
import { cn, fmtNumber, shortAddress } from '@/lib/utils';
import { etherscanApiKey } from '@/lib/env';
import { fetchOnChainTransactions, normalizeEtherscanResult } from '@/lib/onchain/history';
import { getWalletHistory, getInAppTransactions } from '@/services/crypto';
import type { EtherscanTransaction, InAppTransaction } from '@/types/crypto';
import { useCrypto } from '../CryptoContext';

type Mode = 'onchain' | 'inapp';

/** Tab "Lịch sử" — on-chain (explorer) và in-app (backend đã ghi). */
export function HistoryTab() {
  const { data, explorerTxUrl, txCenter } = useCrypto();
  const { activeWallet, activeNetwork, activeWalletId } = data;

  const [mode, setMode] = useState<Mode>('onchain');
  const [onchain, setOnchain] = useState<EtherscanTransaction[]>([]);
  const [inApp, setInApp] = useState<InAppTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [onchainHint, setOnchainHint] = useState<string | null>(null);
  const prevPendingRef = useRef(txCenter.pendingCount);

  const load = useCallback(async () => {
    if (!activeWalletId || !activeWallet) return;
    setLoading(true);
    setOnchainHint(null);
    try {
      if (mode === 'onchain') {
        const res = await getWalletHistory(activeWalletId);
        let rows = normalizeEtherscanResult(res.result);

        // Backend trả rỗng → thử Etherscan V2 trực tiếp (cần VITE_ETHERSCAN_API_KEY).
        if (rows.length === 0) {
          const fallback = await fetchOnChainTransactions(
            activeWallet.blockchainNetwork,
            activeWallet.walletAddress,
            etherscanApiKey(),
          );
          if (fallback.length > 0) {
            rows = fallback;
          } else if (!etherscanApiKey()) {
            setOnchainHint(
              'Chưa cấu hình API key Etherscan — thêm VITE_ETHERSCAN_API_KEY vào .env.local hoặc ETHERSCAN_API_KEY trên backend.',
            );
          }
        }

        setOnchain(rows);
      } else {
        const page = await getInAppTransactions(activeWalletId);
        setInApp(page.content ?? []);
      }
    } catch (error) {
      toastErr(error, 'Không tải được lịch sử giao dịch');
    } finally {
      setLoading(false);
    }
  }, [activeWallet, activeWalletId, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  // Tx vừa hoàn tất (swap/gửi) → làm mới lịch sử in-app.
  useEffect(() => {
    if (prevPendingRef.current > txCenter.pendingCount) {
      void load();
    }
    prevPendingRef.current = txCenter.pendingCount;
  }, [txCenter.pendingCount, load]);

  if (!activeWallet) {
    return (
      <Card className="py-10 text-center text-slate-400">
        Liên kết ví để xem lịch sử giao dịch.
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <History className="h-5 w-5 text-[--color-primary]" /> Lịch sử giao dịch
          </h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              fullWidth={false}
              loading={loading}
              onClick={() => void load()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <div className="flex gap-1 rounded-xl border border-[--color-border] bg-black/20 p-1">
              {(
                [
                  ['onchain', 'On-chain'],
                  ['inapp', 'Trong ứng dụng'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={cn(
                    'rounded-lg px-4 py-1.5 text-xs font-bold transition-colors',
                    mode === id
                      ? 'bg-[--color-primary-soft] text-[--color-primary]'
                      : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        ) : mode === 'onchain' ? (
          onchain.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <p>Chưa có giao dịch on-chain nào.</p>
              {onchainHint ? <p className="mt-2 text-xs text-amber-400/90">{onchainHint}</p> : null}
            </div>
          ) : (
            <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
              {onchain.map((tx) => {
                const received =
                  tx.to?.toLowerCase() === activeWallet.walletAddress.toLowerCase();
                const value = formatEther(BigInt(tx.value || '0'));
                return (
                  <div
                    key={tx.hash}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[--color-border] bg-white/[0.02] p-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                          received ? 'bg-emerald-500/15' : 'bg-rose-500/15',
                        )}
                      >
                        {received ? (
                          <ArrowDownToLine className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <ArrowUpFromLine className="h-5 w-5 text-rose-400" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">
                          {received ? 'Nhận' : 'Gửi'} {fmtNumber(value, 6)}{' '}
                          {activeNetwork?.nativeSymbol}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {received ? `Từ ${shortAddress(tx.from)}` : `Đến ${shortAddress(tx.to)}`} ·{' '}
                          {new Date(Number(tx.timeStamp) * 1000).toLocaleString('vi-VN')}
                        </p>
                        <a
                          href={explorerTxUrl(tx.hash)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-[--color-primary] hover:underline"
                        >
                          Xem trên explorer <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                    <p
                      className={cn(
                        'shrink-0 font-black',
                        received ? 'text-emerald-400' : 'text-rose-400',
                      )}
                    >
                      {received ? '+' : '−'}
                      {fmtNumber(value, 6)}
                    </p>
                  </div>
                );
              })}
            </div>
          )
        ) : inApp.length === 0 ? (
          <p className="py-8 text-center text-slate-500">
            Chưa có giao dịch nào thực hiện qua ứng dụng.
            <span className="mt-2 block text-xs text-slate-600">
              Gửi, swap hoặc thu hồi quyền sẽ xuất hiện ở đây sau khi phát lệnh.
            </span>
          </p>
        ) : (
          <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {inApp.map((tx) => {
              const done = tx.status === 'SUCCESS' || tx.status === 'CONFIRMED';
              const failed = tx.status === 'FAILED';
              const label = tx.description ?? `${tx.type} ${fmtNumber(tx.amount, 6)} ${tx.symbol}`;
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[--color-border] bg-white/[0.02] p-3.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
                        done ? 'bg-emerald-500/15' : failed ? 'bg-rose-500/15' : 'bg-amber-500/15',
                      )}
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      ) : failed ? (
                        <WifiOff className="h-5 w-5 text-rose-400" />
                      ) : (
                        <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">{label}</p>
                      <p className="truncate text-xs text-slate-500">
                        {tx.toAddress ? `Đến ${shortAddress(tx.toAddress)} · ` : ''}
                        {new Date(tx.createdAt).toLocaleString('vi-VN')}
                      </p>
                      {tx.txHash ? (
                        <a
                          href={explorerTxUrl(tx.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-xs text-[--color-primary] hover:underline"
                        >
                          {shortAddress(tx.txHash, 10, 8)} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-bold uppercase text-slate-400">
                    {tx.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
