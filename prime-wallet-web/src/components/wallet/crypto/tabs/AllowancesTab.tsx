import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { formatUnits } from 'viem';
import { BadgeCheck, ShieldOff, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { toastErr, toastOk } from '@/components/feedback/toast';
import { fmtNumber, shortAddress } from '@/lib/utils';
import { getPublicClient } from '@/lib/wagmi/clients';
import { etherscanApiKey } from '@/lib/env';
import { scanAllowances, buildRevokeCalldata } from '@/lib/allowance/scan';
import { useCrypto } from '../CryptoContext';

/** Tab "Quyền" — rà soát & thu hồi allowance ERC-20 đã cấp. */
export function AllowancesTab() {
  const { data, address, unlock, signAndSend } = useCrypto();
  const { activeWallet, balance } = data;
  const queryClient = useQueryClient();

  const networkId = activeWallet?.blockchainNetwork;
  const knownTokens = useMemo(
    () =>
      (balance?.tokens ?? [])
        .map((token) => token.contractAddress)
        .filter((address): address is `0x${string}` => Boolean(address)),
    [balance],
  );

  const query = useQuery({
    queryKey: ['allowances', networkId, address],
    enabled: Boolean(networkId && address),
    staleTime: 30_000,
    queryFn: async () => {
      return scanAllowances({
        client: getPublicClient(networkId!),
        networkId: networkId!,
        owner: address!,
        knownTokens,
        etherscanApiKey: etherscanApiKey(),
      });
    },
  });

  const revoke = async (tokenAddress: `0x${string}`, spender: `0x${string}`, symbol: string) => {
    try {
      const hash = await signAndSend({
        to: tokenAddress,
        data: buildRevokeCalldata(spender),
        summary: `Thu hồi quyền ${symbol} · ${shortAddress(spender)}`,
      });
      if (unlock.wasCanceled()) {
        unlock.consumeCanceled();
        return;
      }
      if (!hash) return;
      toastOk('Đã phát lệnh thu hồi', `${symbol} · ${shortAddress(spender)}`);
      void queryClient.invalidateQueries({ queryKey: ['allowances'] });
    } catch (error) {
      toastErr(error, 'Không thu hồi được quyền');
    }
  };

  if (!activeWallet) {
    return <Card className="py-10 text-center text-slate-400">Liên kết ví để rà soát quyền.</Card>;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <BadgeCheck className="h-5 w-5 text-[--color-primary]" /> Quyền chi tiêu (Allowance)
          </h3>
          {query.data ? (
            <Badge variant={query.data.entries.length > 0 ? 'warning' : 'default'}>
              {query.data.entries.length} quyền đang hiệu lực
            </Badge>
          ) : null}
        </div>
        <p className="mb-5 text-sm text-slate-400">
          Các hợp đồng đã được phép chi tiêu token của bạn. Nên thu hồi những quyền không còn dùng —
          việc này không ảnh hưởng tới số dư, chỉ chặn hợp đồng đó tiêu token của bạn.
        </p>

        {query.isPending ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        ) : query.data?.entries.length === 0 ? (
          <div className="py-10 text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/10">
              <ShieldOff className="h-7 w-7 text-emerald-400" />
            </div>
            <p className="text-slate-400">Không có quyền chi tiêu nào đang hiệu lực.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {query.data?.entries.map((entry) => (
              <div
                key={`${entry.token}:${entry.spender}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[--color-border] bg-white/[0.02] p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-white">{entry.tokenSymbol}</p>
                    {entry.isUnlimited ? <Badge variant="danger">Vô hạn</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {entry.spenderName ?? 'Hợp đồng'} · {shortAddress(entry.spender)}
                  </p>
                  {entry.spenderDescription ? (
                    <p className="mt-0.5 text-xs text-slate-400">{entry.spenderDescription}</p>
                  ) : null}
                  <p className="mt-1 font-mono text-xs text-slate-400">
                    {fmtNumber(formatUnits(entry.amount, entry.tokenDecimals), 6)} {entry.tokenSymbol}
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  fullWidth={false}
                  onClick={() => void revoke(entry.token, entry.spender, entry.tokenSymbol)}
                >
                  <Trash2 className="h-4 w-4" /> Thu hồi
                </Button>
              </div>
            ))}
          </div>
        )}

        {query.data?.truncated || query.data?.logScanUnavailable ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90">
            {query.data.logScanUnavailable
              ? 'Mạng này không quét được log lịch sử — danh sách chỉ dựa trên các hợp đồng phổ biến. Nên kiểm tra thủ công trên explorer.'
              : 'Lịch sử approve rất dài nên danh sách bị cắt — có thể còn quyền chưa liệt kê hết.'}
          </p>
        ) : null}
      </Card>
    </motion.div>
  );
}
