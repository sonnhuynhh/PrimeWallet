import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { encodeFunctionData, parseEther, parseUnits } from 'viem';
import { ArrowRight, Landmark, Loader2, Timer } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toastErr, toastOk } from '@/components/feedback/toast';
import { clampDecimals, fmtNumber, fmtVnd } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import {
  createBridgeQuote,
  confirmBridgeOrder,
  getBridgeRates,
  type BridgeQuote,
  type BridgeRates,
} from '@/services/bridge';
import type { TokenBalance } from '@/types/crypto';
import { useCrypto } from '../CryptoContext';

async function waitForReceipt(rpcUrl: string, hash: string, attempts = 30) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  for (let i = 0; i < attempts; i += 1) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (receipt) return receipt;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Giao dịch chưa được xác nhận on-chain. Vui lòng thử xác nhận lại sau.');
}

/**
 * Tab "Đổi VND" — bán crypto on-chain, nhận VND trên ví Fiat.
 *
 * Luồng: báo giá → gửi tới treasury → xác minh tx → cộng VND.
 */
export function BridgeTab() {
  const { data, signAndSend } = useCrypto();
  const { reloadSession } = useAuth();
  const { activeWallet, activeNetwork, balance, tokenRows, loadBalance } = data;

  const [token, setToken] = useState<TokenBalance | null>(null);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [liveRates, setLiveRates] = useState<BridgeRates | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);

  const selectableTokens = useMemo(() => {
    const nativeSymbol = balance?.nativeSymbol ?? activeNetwork?.nativeSymbol ?? 'ETH';
    const native: TokenBalance = {
      symbol: nativeSymbol,
      name: nativeSymbol,
      balance: balance?.balanceEth ?? '0',
      decimals: 18,
      contractAddress: undefined,
      isNative: true,
    };
    const erc20 = tokenRows.filter(
      (t) => Number(t.balance) > 0 && !t.isNative && t.contractAddress,
    );
    return [native, ...erc20];
  }, [balance, activeNetwork, tokenRows]);

  const selected = token ?? selectableTokens[0] ?? null;
  const isNative = !selected?.contractAddress;
  const decimals = selected?.decimals ?? 18;
  const symbol = selected?.symbol ?? 'ETH';
  const available = selected?.balance ?? '0';

  const amountValid = Number(amount) > 0 && Number(amount) <= Number(available);

  const liveRate = liveRates?.rates?.[symbol] ?? null;

  useEffect(() => {
    if (!activeWallet) {
      setLiveRates(null);
      return;
    }
    let cancelled = false;
    setRatesLoading(true);
    void getBridgeRates(activeWallet.blockchainNetwork)
      .then((data) => {
        if (!cancelled) setLiveRates(data);
      })
      .catch(() => {
        if (!cancelled) setLiveRates(null);
      })
      .finally(() => {
        if (!cancelled) setRatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeWallet?.id, activeWallet?.blockchainNetwork]);

  const rateBadgeLabel = useMemo(() => {
    const source = quote?.rateSource ?? liveRates?.source;
    if (source === 'coingecko') return 'Realtime · CoinGecko';
    if (source === 'fallback') return 'Tỷ giá dự phòng';
    return ratesLoading ? 'Đang tải tỷ giá…' : 'Tỷ giá';
  }, [quote?.rateSource, liveRates?.source, ratesLoading]);

  const rateUpdatedLabel = useMemo(() => {
    const ts = quote?.rateUpdatedAt ?? liveRates?.updatedAt;
    if (!ts) return null;
    return new Date(ts).toLocaleTimeString('vi-VN');
  }, [quote?.rateUpdatedAt, liveRates?.updatedAt]);

  if (!activeWallet) {
    return <Card className="py-10 text-center text-slate-400">Liên kết ví để đổi sang VND.</Card>;
  }

  const handleQuote = async () => {
    if (!selected || !amountValid) return;
    setQuoting(true);
    setQuote(null);
    try {
      const q = await createBridgeQuote({
        cryptoWalletId: activeWallet.id,
        tokenSymbol: symbol,
        tokenAddress: isNative ? undefined : selected.contractAddress,
        tokenDecimals: isNative ? undefined : selected.decimals,
        amount: clampDecimals(amount, decimals),
      });
      setQuote(q);
      setPendingTxHash(null);
    } catch (error) {
      toastErr(error, 'Không tạo được báo giá');
    } finally {
      setQuoting(false);
    }
  };

  const handleBridge = async () => {
    if (!quote || !selected) return;
    setSubmitting(true);
    try {
      let hash: `0x${string}` | null;

      if (isNative) {
        hash = await signAndSend({
          to: quote.treasuryAddress as `0x${string}`,
          value: parseEther(clampDecimals(amount, decimals)),
          summary: `Đổi ${amount} ${symbol} → VND`,
        });
      } else {
        const data = encodeFunctionData({
          abi: [
            {
              name: 'transfer',
              type: 'function',
              stateMutability: 'nonpayable',
              inputs: [
                { name: 'to', type: 'address' },
                { name: 'value', type: 'uint256' },
              ],
              outputs: [{ name: '', type: 'bool' }],
            },
          ],
          functionName: 'transfer',
          args: [
            quote.treasuryAddress as `0x${string}`,
            parseUnits(clampDecimals(amount, decimals), decimals),
          ],
        });
        hash = await signAndSend({
          to: selected.contractAddress as `0x${string}`,
          data,
          value: 0n,
          summary: `Đổi ${amount} ${symbol} → VND`,
        });
      }

      if (!hash) return;
      setPendingTxHash(hash);

      const rpcUrl = activeNetwork?.rpcUrl;
      if (!rpcUrl) {
        throw new Error('Thiếu RPC URL cho mạng hiện tại');
      }
      await waitForReceipt(rpcUrl, hash);

      const order = await confirmBridgeOrder(quote.orderId, hash);
      await reloadSession();
      await loadBalance();

      toastOk(
        'Đổi sang VND thành công',
        `+${fmtVnd(order.vndAmount)} đã được cộng vào ví Fiat`,
      );
      setAmount('');
      setQuote(null);
      setPendingTxHash(null);
    } catch (error) {
      toastErr(error, 'Đổi sang VND thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const retryConfirm = async () => {
    if (!quote || !pendingTxHash) return;
    setSubmitting(true);
    try {
      const order = await confirmBridgeOrder(quote.orderId, pendingTxHash);
      await reloadSession();
      await loadBalance();
      toastOk('Đổi sang VND thành công', `+${fmtVnd(order.vndAmount)} đã được cộng vào ví Fiat`);
      setAmount('');
      setQuote(null);
      setPendingTxHash(null);
    } catch (error) {
      toastErr(error, 'Xác nhận thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-xl space-y-4"
    >
      <Card className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/15">
            <Landmark className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Đổi Crypto → VND</h2>
            <p className="text-sm text-slate-400">
              Gửi token tới ví treasury, nhận VND trên ví Fiat ngay sau khi xác minh.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Token bán
          </label>
          <div className="flex flex-wrap gap-2">
            {selectableTokens.map((t) => {
              const active =
                (selected?.contractAddress ?? '') === (t.contractAddress ?? '') &&
                selected?.symbol === t.symbol;
              return (
                <button
                  key={`${t.symbol}-${t.contractAddress ?? `native-${t.symbol}`}`}
                  type="button"
                  onClick={() => {
                    setToken(t);
                    setQuote(null);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                    active
                      ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
                      : 'border-[--color-border] bg-[--color-surface-2] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {t.symbol}
                  <span className="ml-1.5 text-xs font-normal text-slate-500">
                    {fmtNumber(Number(t.balance), 4)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Số lượng
          </label>
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="any"
              placeholder="0.0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setQuote(null);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setAmount(available);
                setQuote(null);
              }}
            >
              Tối đa
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Khả dụng: {fmtNumber(Number(available), 6)} {symbol}
            {liveRate != null ? (
              <span className="ml-2 text-emerald-400/90">
                · 1 {symbol} ≈ {fmtNumber(liveRate, 0)} VND
              </span>
            ) : null}
          </p>
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={!amountValid || quoting}
          onClick={handleQuote}
        >
          {quoting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Lấy báo giá VND
        </Button>
      </Card>

      {quote ? (
        <Card className="space-y-4 border-emerald-500/25 bg-emerald-500/5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-400">Bạn nhận (ước tính)</p>
            <Badge variant={quote.rateSource === 'fallback' ? 'warning' : 'success'}>
              {rateBadgeLabel}
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-4xl font-black text-white">
              {fmtVnd(quote.vndAmount)}
            </span>
            <span className="text-lg font-bold text-emerald-400">VND</span>
          </div>
          <p className="text-sm text-slate-400">
            {quote.tokenAmount} {quote.tokenSymbol} × {fmtNumber(quote.rateVnd, 0)} VND
            {rateUpdatedLabel ? (
              <span className="block text-xs text-slate-500">Cập nhật lúc {rateUpdatedLabel}</span>
            ) : null}
          </p>

          <div className="rounded-xl border border-[--color-border] bg-[--color-surface-2] p-3 text-xs text-slate-400">
            <p className="mb-1 font-semibold text-slate-300">Gửi tới treasury</p>
            <p className="break-all font-mono">{quote.treasuryAddress}</p>
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-400/90">
            <Timer className="h-3.5 w-3.5 shrink-0" />
            Báo giá hết hạn lúc {new Date(quote.expiresAt).toLocaleTimeString('vi-VN')}
          </div>

          <Button
            type="button"
            className="w-full bg-emerald-600 hover:bg-emerald-500"
            disabled={submitting}
            onClick={handleBridge}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            {pendingTxHash ? 'Gửi lại' : 'Gửi & đổi sang VND'}
          </Button>

          {pendingTxHash ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={submitting}
              onClick={retryConfirm}
            >
              Xác nhận lại giao dịch đã gửi
            </Button>
          ) : null}
        </Card>
      ) : null}
    </motion.div>
  );
}
