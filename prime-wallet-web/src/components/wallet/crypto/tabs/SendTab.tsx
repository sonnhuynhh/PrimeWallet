import { useState } from 'react';
import { motion } from 'framer-motion';
import { ethers } from 'ethers';
import { encodeFunctionData, parseEther, parseUnits } from 'viem';
import { ArrowUpFromLine, Fuel, Loader2, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { toastErr, toastTx } from '@/components/feedback/toast';
import { clampDecimals, fmtNumber } from '@/lib/utils';
import { sendWithWalletClient } from '@/lib/wagmi/sendTx';
import { estimateGas, recordTransaction, sendTransaction } from '@/services/crypto';
import type { EstimateGasData, TokenBalance } from '@/types/crypto';
import { useCrypto } from '../CryptoContext';

/**
 * Tab "Gửi" — chuyển native coin hoặc ERC-20.
 *
 * Luồng giữ nguyên thiết kế non-custodial cũ: ước tính gas ở backend, ký offline
 * trong trình duyệt, backend chỉ phát tx đã ký và ghi lịch sử.
 */
export function SendTab({ initialToken = null }: { initialToken?: TokenBalance | null }) {
  const { data, requireSigner, unlock, txCenter, chainId, usesWalletClient, wagmiConfig } = useCrypto();
  const { activeWallet, activeNetwork, balance, tokenRows, loadBalance } = data;

  const [token, setToken] = useState<TokenBalance | null>(initialToken);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [gas, setGas] = useState<EstimateGasData | null>(null);
  const [gasLoading, setGasLoading] = useState(false);
  const [sending, setSending] = useState(false);

  if (!activeWallet) {
    return <Card className="py-10 text-center text-slate-400">Liên kết ví để gửi tài sản.</Card>;
  }

  const isNative = !token?.contractAddress;
  const decimals = token?.decimals ?? 18;
  const symbol = token?.symbol ?? balance?.nativeSymbol ?? activeNetwork?.nativeSymbol ?? 'ETH';
  const available = isNative ? (balance?.balanceEth ?? '0') : (token?.balance ?? '0');

  const addressValid = ethers.isAddress(to.trim());
  const amountValid = Number(amount) > 0 && Number(amount) <= Number(available);
  const canSubmit = addressValid && amountValid && !sending;

  const previewGas = async () => {
    if (!addressValid || !amountValid) return;
    setGasLoading(true);
    setGas(null);
    try {
      setGas(
        await estimateGas({
          blockchainNetwork: activeWallet.blockchainNetwork,
          fromAddress: activeWallet.walletAddress,
          toAddress: to.trim(),
          amount,
          tokenAddress: isNative ? undefined : token!.contractAddress,
          tokenDecimals: isNative ? undefined : token!.decimals,
        }),
      );
    } catch (error) {
      toastErr(error, 'Không ước tính được gas');
    } finally {
      setGasLoading(false);
    }
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSending(true);
    try {
      let transactionHash: string;

      if (usesWalletClient) {
        // Ví ngoài / wagmi: extension xác nhận, không nhập seed.
        if (isNative) {
          transactionHash = await sendWithWalletClient(wagmiConfig, {
            to: to.trim() as `0x${string}`,
            value: parseEther(amount),
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
              to.trim() as `0x${string}`,
              parseUnits(clampDecimals(amount, decimals), decimals),
            ],
          });
          transactionHash = await sendWithWalletClient(wagmiConfig, {
            to: token!.contractAddress as `0x${string}`,
            data,
          });
        }

        const result = await recordTransaction({
          blockchainNetwork: activeWallet.blockchainNetwork,
          transactionHash,
          fromAddress: activeWallet.walletAddress,
          toAddress: to.trim(),
          amount,
          symbol,
          tokenAddress: token?.contractAddress,
        });
        transactionHash = result.transactionHash;
      } else {
        const signer = await requireSigner();
        if (unlock.wasCanceled()) {
          unlock.consumeCanceled();
          return;
        }
        if (!signer) return;

        const rpcUrl = activeNetwork?.rpcUrl;
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const connected = signer.connect(provider);

        let request: ethers.TransactionRequest;
        if (isNative) {
          request = await connected.populateTransaction({
            to: to.trim(),
            value: ethers.parseEther(amount),
          });
        } else {
          const erc20 = new ethers.Contract(
            token!.contractAddress!,
            ['function transfer(address to, uint256 value) returns (bool)'],
            connected,
          );
          request = await erc20.transfer.populateTransaction(
            to.trim(),
            ethers.parseUnits(clampDecimals(amount, decimals), decimals),
          );
        }

        const signedTransactionHex = await connected.signTransaction(request);
        const result = await sendTransaction({
          blockchainNetwork: activeWallet.blockchainNetwork,
          signedTransactionHex,
          fromAddress: activeWallet.walletAddress,
          toAddress: to.trim(),
          amount,
          symbol,
          tokenAddress: token?.contractAddress,
        });
        transactionHash = result.transactionHash;
      }

      if (chainId) {
        txCenter.track({
          chainId,
          hash: transactionHash as `0x${string}`,
          summary: `Gửi ${amount} ${symbol}`,
        });
      }

      toastTx('Đã phát giao dịch', {
        hash: transactionHash,
        explorerUrl: activeNetwork?.explorerUrl,
        description: `${amount} ${symbol} → ${to.trim().slice(0, 10)}…`,
      });

      setTo('');
      setAmount('');
      setGas(null);
      void loadBalance();
    } catch (error) {
      toastErr(error, 'Không gửi được giao dịch');
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="mx-auto max-w-xl">
        <h3 className="mb-1 flex items-center gap-2 text-lg font-bold text-white">
          <ArrowUpFromLine className="h-5 w-5 text-[--color-primary]" /> Gửi tài sản
        </h3>
        <p className="mb-6 text-sm text-slate-400">
          Giao dịch được ký ngay trong trình duyệt — khoá riêng tư không rời máy bạn.
        </p>

        <form onSubmit={handleSend} className="space-y-4">
          {/* Chọn tài sản */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-300">Tài sản</label>
            <div className="flex flex-wrap gap-2">
              {tokenRows.map((row) => {
                const selected = (row.contractAddress ?? null) === (token?.contractAddress ?? null);
                return (
                  <button
                    key={row.symbol + (row.contractAddress ?? 'native')}
                    type="button"
                    onClick={() => {
                      setToken(row.isNative ? null : row);
                      setGas(null);
                    }}
                    className={
                      selected
                        ? 'rounded-xl border border-[--color-primary]/60 bg-[--color-primary-soft] px-4 py-2 text-sm font-bold text-[--color-primary]'
                        : 'rounded-xl border border-[--color-border] bg-white/[0.03] px-4 py-2 text-sm font-bold text-slate-400 transition-colors hover:border-[--color-primary]/40'
                    }
                  >
                    {row.symbol}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Khả dụng: {fmtNumber(available, 6)} {symbol}
            </p>
          </div>

          <Input
            label="Địa chỉ nhận"
            placeholder="0x…"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setGas(null);
            }}
            error={to.length > 0 && !addressValid ? 'Địa chỉ ví không hợp lệ' : undefined}
          />

          <Input
            label={`Số lượng (${symbol})`}
            type="number"
            step="any"
            min="0"
            placeholder="0.0"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setGas(null);
            }}
            error={
              amount.length > 0 && Number(amount) > Number(available)
                ? 'Số dư không đủ'
                : undefined
            }
            hint={
              <button
                type="button"
                className="text-[--color-primary] hover:underline"
                onClick={() => {
                  setAmount(available);
                  setGas(null);
                }}
              >
                Dùng tối đa
              </button>
            }
          />

          {/* Xem trước phí */}
          <div className="rounded-xl border border-[--color-border] bg-black/20 p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <Fuel className="h-4 w-4 text-[--color-primary]" /> Phí gas dự kiến
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                fullWidth={false}
                loading={gasLoading}
                disabled={!addressValid || !amountValid}
                onClick={() => void previewGas()}
              >
                Ước tính
              </Button>
            </div>
            {gas ? (
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Gas limit</dt>
                  <dd className="font-mono text-slate-300">{gas.gasLimit}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Tổng phí</dt>
                  <dd className="font-semibold text-white">
                    {fmtNumber(gas.totalFeeEth, 8)} {gas.nativeSymbol}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Nhập địa chỉ và số lượng rồi bấm Ước tính để xem phí trước khi ký.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            {usesWalletClient
              ? 'Giao dịch được xác nhận qua ví đã kết nối (MetaMask, OKX…).'
              : 'Ví in-app: chỉ nhập seed phrase một lần mỗi phiên trình duyệt.'}
          </div>

          <Button type="submit" loading={sending} disabled={!canSubmit}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Đang ký &amp; phát…
              </>
            ) : (
              <>
                Gửi {amount || '0'} {symbol}
              </>
            )}
          </Button>

          {activeNetwork?.testnet ? (
            <p className="text-center">
              <Badge variant="warning">Đang dùng testnet — tài sản không có giá trị thật</Badge>
            </p>
          ) : null}
        </form>
      </Card>
    </motion.div>
  );
}
