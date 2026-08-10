import { motion } from 'framer-motion';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { AppIcon } from '@/components/ui/AppIcon';
import { toastOk } from '@/components/feedback/toast';
import { cn, fmtNumber, shortAddress } from '@/lib/utils';
import { useCrypto } from '../CryptoContext';

/** Tab "Tài sản" — số dư native + token, phong cách Uniswap. */
export function AssetsTab() {
  const { data, openSend, openLink, address } = useCrypto();
  const { activeWallet, activeNetwork, balance, tokenRows, refreshing, loadBalance, error } = data;
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toastOk('Đã sao chép địa chỉ ví');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!activeWallet) {
    return (
      <Card beam className="py-14 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-[--color-primary-soft]">
          <AppIcon name="lucide:wallet" size={32} className="text-[--color-primary]" />
        </div>
        <h3 className="mb-2 font-display text-xl font-bold text-white">Chưa có ví Crypto</h3>
        <p className="mx-auto mb-6 max-w-md text-[--color-muted-foreground]">
          Kết nối OKX / MetaMask, liên kết ví có sẵn, hoặc tạo ví mới. Bạn nắm giữ khoá riêng tư —
          PrimeWallet chỉ lưu địa chỉ công khai.
        </p>
        <div className="flex justify-center gap-3">
          <Button fullWidth={false} onClick={() => openLink('create')}>
            <AppIcon name="lucide:plus" size={16} /> Tạo ví mới
          </Button>
          <Button fullWidth={false} variant="secondary" onClick={() => openLink('link')}>
            Liên kết ví có sẵn
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <Card beam className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[--color-primary]/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-[--color-muted-foreground]">
                <AppIcon name="lucide:wallet" size={16} className="text-[--color-primary]" />
                Số dư · {activeNetwork?.label ?? activeWallet.blockchainNetwork}
                {activeNetwork?.testnet ? <Badge variant="warning">Testnet</Badge> : null}
              </p>
              <div className="flex items-baseline gap-2">
                {refreshing && !balance ? (
                  <Skeleton className="h-12 w-56" />
                ) : (
                  <h1 className="break-all font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
                    {fmtNumber(balance?.balanceEth ?? '0', 6)}
                  </h1>
                )}
                <span className="text-2xl font-bold text-[--color-primary]">
                  {balance?.nativeSymbol || activeNetwork?.nativeSymbol}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadBalance()}
              title="Làm mới số dư"
              className="rounded-full border border-[--color-border] bg-white/[0.03] p-2.5 text-[--color-primary] transition-colors hover:bg-white/[0.06]"
            >
              <AppIcon
                name="lucide:refresh-cw"
                size={18}
                className={cn(refreshing && 'animate-spin')}
              />
            </button>
          </div>

          {error ? (
            <p className="mt-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[--color-border] bg-black/25 p-3">
            <p className="min-w-0 flex-1 break-all font-mono text-xs text-[--color-muted-foreground]">
              {activeWallet.walletAddress}
            </p>
            <button
              type="button"
              onClick={() => void copyAddress()}
              title="Sao chép địa chỉ"
              className="rounded-xl p-1.5 text-[--color-muted-foreground] transition-colors hover:bg-white/5 hover:text-white"
            >
              <AppIcon
                name={copied ? 'lucide:check-circle-2' : 'lucide:copy'}
                size={16}
                className={copied ? 'text-emerald-400' : undefined}
              />
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-white">
            <AppIcon name="lucide:coins" size={18} className="text-[--color-primary]" />
            Token &amp; Coin
          </h3>
          <p className="text-xs text-[--color-muted-foreground]">{tokenRows.length} tài sản</p>
        </div>

        {refreshing && tokenRows.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {tokenRows.map((token) => (
              <div
                key={token.symbol + (token.contractAddress ?? 'native')}
                className="flex items-center justify-between rounded-2xl border border-[--color-border] bg-white/[0.02] p-3.5 transition-colors hover:border-[--color-primary]/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <TokenIcon symbol={token.symbol} size={40} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold text-white">
                      {token.symbol}
                      {token.isNative ? <Badge variant="primary">Native</Badge> : null}
                    </p>
                    <p className="truncate text-xs text-[--color-muted-foreground]">{token.name}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-white">{fmtNumber(token.balance, 6)}</p>
                    <p className="font-mono text-xs text-[--color-muted-foreground]">
                      {token.contractAddress ? shortAddress(token.contractAddress) : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openSend(token.isNative ? null : token)}
                    title={`Gửi ${token.symbol}`}
                    className="rounded-full bg-[--color-primary-soft] p-2.5 text-[--color-primary] transition-colors hover:brightness-125"
                  >
                    <AppIcon name="lucide:arrow-up-from-line" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </motion.div>
  );
}
