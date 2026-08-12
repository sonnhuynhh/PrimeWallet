import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { formatUnits, parseUnits } from 'viem';
import { ArrowDownUp, Loader2, Route, TriangleAlert, Zap } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { TokenPicker } from '@/components/ui/TokenPicker';
import { toastErr, toastOk } from '@/components/feedback/toast';
import { clampDecimals, cn, decimalAmountString, fmtNumber } from '@/lib/utils';
import { useSwapQuote } from '@/lib/hooks/useSwapQuote';
import {
  DEFAULT_SLIPPAGE_BPS,
  SLIPPAGE_PRESETS_BPS,
  SEPOLIA_TOKENS,
  feeLabel,
  isSwapSupported,
  needsSwapApproval,
  buildApproveCalldata,
  isNativeAddress,
  type DexToken,
} from '@/lib/dex';
import { useCrypto } from '../CryptoContext';

/**
 * Tab "Swap" — hai nguồn quote tuỳ chain:
 * Sepolia dùng engine Uniswap V3 tự viết, mainnet dùng aggregator LI.FI.
 * UI không phân biệt: cả hai trả về cùng shape `SwapQuote`.
 */
export function SwapTab() {
  const { data, chainId, address, signAndSend } = useCrypto();
  const { activeNetwork, balance, tokenRows, loadBalance } = data;

  const tokens = useMemo<DexToken[]>(() => SEPOLIA_TOKENS, []);
  const [tokenIn, setTokenIn] = useState<DexToken>(tokens[0]);
  const [tokenOut, setTokenOut] = useState<DexToken>(tokens[2]);
  const [amountText, setAmountText] = useState('');
  const [slippageBps, setSlippageBps] = useState<number>(DEFAULT_SLIPPAGE_BPS);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void loadBalance();
  }, [loadBalance]);

  const tokenRow = useMemo(() => {
    if (isNativeAddress(tokenIn.address)) return null;
    return (
      tokenRows.find(
        (t) => t.contractAddress?.toLowerCase() === tokenIn.address.toLowerCase(),
      ) ?? null
    );
  }, [tokenIn.address, tokenRows]);

  const available = useMemo(() => {
    if (isNativeAddress(tokenIn.address)) {
      return balance?.balanceEth ?? '0';
    }
    return tokenRow?.balance ?? '0';
  }, [tokenIn.address, balance?.balanceEth, tokenRow]);

  const maxAmountWei = useMemo(() => {
    try {
      if (isNativeAddress(tokenIn.address) && balance?.balanceWei) {
        return BigInt(balance.balanceWei);
      }
      if (tokenRow?.rawBalance) {
        return BigInt(tokenRow.rawBalance);
      }
      const human = decimalAmountString(available, tokenIn.decimals);
      return parseUnits(clampDecimals(human, tokenIn.decimals), tokenIn.decimals);
    } catch {
      return 0n;
    }
  }, [available, tokenIn.address, tokenIn.decimals, balance?.balanceWei, tokenRow?.rawBalance]);

  const supported = isSwapSupported(chainId);

  const amountIn = useMemo(() => {
    if (!amountText || Number(amountText) <= 0) return 0n;
    try {
      return parseUnits(clampDecimals(amountText, tokenIn.decimals), tokenIn.decimals);
    } catch {
      return 0n;
    }
  }, [amountText, tokenIn.decimals]);

  const exceedsBalance = amountIn > 0n && maxAmountWei > 0n && amountIn > maxAmountWei;

  const handleAmountChange = (raw: string) => {
    const cleaned = raw.replace(/,/g, '.');
    if (cleaned === '' || cleaned === '.') {
      setAmountText(cleaned);
      return;
    }
    if (!/^\d*\.?\d*$/.test(cleaned)) return;

    try {
      const parsed = parseUnits(clampDecimals(cleaned, tokenIn.decimals), tokenIn.decimals);
      if (maxAmountWei > 0n && parsed > maxAmountWei) {
        setAmountText(clampDecimals(formatUnits(maxAmountWei, tokenIn.decimals), tokenIn.decimals));
        return;
      }
    } catch {
      // Cho phép nhập dở (vd. "0.")
    }
    setAmountText(cleaned);
  };

  const setMaxAmount = () => {
    if (maxAmountWei === 0n) {
      setAmountText('');
      return;
    }
    setAmountText(clampDecimals(formatUnits(maxAmountWei, tokenIn.decimals), tokenIn.decimals));
  };

  const quoteQuery = useSwapQuote({
    chainId,
    tokenIn,
    tokenOut,
    amountIn,
    slippageBps,
    account: address,
    knownTokens: tokens,
    enabled: supported,
  });

  const quote = quoteQuery.data;

  const flip = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountText('');
  };

  const handleSwap = async () => {
    if (!quote || !address || !chainId) return;
    setSubmitting(true);
    try {
      // ERC-20 → phải approve router trước (OKX/MetaMask simulate sẽ fail nếu thiếu).
      if (
        !isNativeAddress(tokenIn.address) &&
        (await needsSwapApproval({
          chainId,
          owner: address,
          tokenIn,
          spender: quote.approvalAddress,
          amountIn,
        }))
      ) {
        const approveHash = await signAndSend({
          to: tokenIn.address as `0x${string}`,
          data: buildApproveCalldata(quote.approvalAddress),
          value: 0n,
          summary: `Approve ${tokenIn.symbol} cho swap`,
        });
        if (!approveHash) return;
        toastOk('Đã approve token', `${tokenIn.symbol} — tiếp tục swap…`);
      }

      const hash = await signAndSend({
        to: quote.txRequest.to,
        data: quote.txRequest.data,
        value: quote.txRequest.value,
        gasLimit: quote.txRequest.gasLimit,
        summary: `Swap ${amountText} ${tokenIn.symbol} → ${tokenOut.symbol}`,
      });
      if (hash) {
        toastOk('Đã phát lệnh swap', `${tokenIn.symbol} → ${tokenOut.symbol}`);
        setAmountText('');
        void loadBalance();
      }
    } catch (error) {
      toastErr(error, 'Swap thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  if (!supported) {
    return (
      <Card className="mx-auto max-w-xl py-12 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10">
          <TriangleAlert className="h-7 w-7 text-amber-400" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-white">Mạng này chưa hỗ trợ swap</h3>
        <p className="mx-auto max-w-md text-sm text-slate-400">
          Swap chạy trên Ethereum Sepolia (engine Uniswap V3 tự viết) và Ethereum mainnet (aggregator
          LI.FI). Mạng đang chọn: {activeNetwork?.label ?? 'không rõ'}.
        </p>
      </Card>
    );
  }

  const outAmount = quote ? formatUnits(quote.toAmount, quote.tokenOut.decimals) : '';
  const minOut = quote ? formatUnits(quote.toAmountMin, quote.tokenOut.decimals) : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-xl space-y-4"
    >
      <Card>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <Zap className="h-5 w-5 text-[--color-primary]" /> Swap
          </h3>
          {quote ? <Badge variant="primary">{quote.tool}</Badge> : null}
        </div>

        {/* Bán */}
        <div className="rounded-2xl border border-[--color-border] bg-black/20 p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Bán</span>
            <button
              type="button"
              onClick={setMaxAmount}
              className="normal-case tracking-normal text-slate-400 transition-colors hover:text-[--color-primary]"
            >
              Khả dụng:{' '}
              <span className="font-bold text-slate-300">
                {fmtNumber(available, 6)} {tokenIn.symbol}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              value={amountText}
              onChange={(event) => handleAmountChange(event.target.value)}
              placeholder="0.0"
              inputMode="decimal"
              className={cn(
                'min-w-0 flex-1 bg-transparent text-3xl font-bold text-white outline-none placeholder:text-slate-700',
                exceedsBalance && 'text-rose-400',
              )}
            />
            <TokenPicker
              tokens={tokens}
              value={tokenIn}
              onChange={(token) => {
                if (token.address === tokenOut.address) setTokenOut(tokenIn);
                setTokenIn(token);
                setAmountText('');
              }}
            />
          </div>
          {exceedsBalance ? (
            <p className="mt-2 text-xs font-semibold text-rose-400">Số dư không đủ</p>
          ) : null}
        </div>

        <div className="relative z-10 -my-3 flex justify-center">
          <button
            type="button"
            onClick={flip}
            title="Đảo chiều"
            className="grid h-10 w-10 place-items-center rounded-xl border border-[--color-border] bg-slate-900 text-[--color-primary] transition-colors hover:border-[--color-primary]/60"
          >
            <ArrowDownUp className="h-4 w-4" />
          </button>
        </div>

        {/* Mua */}
        <div className="rounded-2xl border border-[--color-border] bg-black/20 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Nhận (dự kiến)
          </div>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              {quoteQuery.isFetching && !quote ? (
                <Skeleton className="h-9 w-40" />
              ) : (
                <p className="truncate text-3xl font-bold text-white">
                  {outAmount ? fmtNumber(outAmount, 8) : '0.0'}
                </p>
              )}
            </div>
            <TokenPicker
              tokens={tokens}
              value={tokenOut}
              onChange={(token) => {
                if (token.address === tokenIn.address) setTokenIn(tokenOut);
                setTokenOut(token);
              }}
            />
          </div>
        </div>

        {/* Slippage */}
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-slate-300">Trượt giá tối đa</p>
          <div className="flex flex-wrap gap-2">
            {SLIPPAGE_PRESETS_BPS.map((bps) => (
              <button
                key={bps}
                type="button"
                onClick={() => setSlippageBps(bps)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors',
                  slippageBps === bps
                    ? 'border-[--color-primary]/60 bg-[--color-primary-soft] text-[--color-primary]'
                    : 'border-[--color-border] bg-white/[0.03] text-slate-400 hover:border-[--color-primary]/40',
                )}
              >
                {(bps / 100).toFixed(bps < 100 ? 1 : 0)}%
              </button>
            ))}
          </div>
        </div>

        {quoteQuery.error ? (
          <p className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-400">
            {(quoteQuery.error as Error).message}
          </p>
        ) : null}

        <Button
          className="mt-5"
          loading={submitting}
          disabled={!quote || amountIn === 0n || submitting || exceedsBalance}
          onClick={() => void handleSwap()}
        >
          {quoteQuery.isFetching && !quote ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tìm route…
            </>
          ) : (
            `Swap ${tokenIn.symbol} → ${tokenOut.symbol}`
          )}
        </Button>
      </Card>

      {/* Chi tiết route */}
      {quote ? (
        <Card>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
            <Route className="h-4 w-4 text-[--color-primary]" /> Chi tiết giao dịch
          </h4>
          <dl className="space-y-2 text-sm">
            <Row label="Nhận tối thiểu">
              {fmtNumber(minOut, 8)} {quote.tokenOut.symbol}
            </Row>
            <Row label="Ảnh hưởng giá">
              {quote.priceImpactPct === null ? (
                <span className="text-slate-500">nguồn không cung cấp</span>
              ) : (
                <span
                  className={cn(
                    quote.priceImpactPct > 0.03 ? 'text-rose-400' : 'text-slate-200',
                  )}
                >
                  {(quote.priceImpactPct * 100).toFixed(2)}%
                </span>
              )}
            </Row>
            <Row label="Phí LP">
              {quote.lpFeePct === null ? (
                <span className="text-slate-500">—</span>
              ) : (
                `${(quote.lpFeePct * 100).toFixed(2)}%`
              )}
            </Row>
            <Row label="Route">
              <span className="text-right">
                {quote.route.hops.map((hop, index) => (
                  <span key={`${hop.tokenIn}-${hop.tokenOut}-${index}`}>
                    {index === 0 ? hop.symbolIn : ''}
                    {' → '}
                    {hop.symbolOut}
                    {hop.fee !== null ? (
                      <span className="text-slate-500"> ({feeLabel(hop.fee)})</span>
                    ) : null}
                  </span>
                ))}
              </span>
            </Row>
            <Row label="Route đã xét">
              {quote.route.candidatesEvaluated} ·{' '}
              {quote.route.source === 'engine' ? 'engine nội bộ' : 'aggregator'}
            </Row>
          </dl>
        </Card>
      ) : null}
    </motion.div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 font-medium text-slate-200">{children}</dd>
    </div>
  );
}
