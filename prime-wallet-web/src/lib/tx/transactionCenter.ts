import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import type { Address } from 'viem';
import { getPublicClient } from '@/lib/wagmi/clients';
import { networkIdOf } from '@/lib/wagmi/chains';

/**
 * Transaction Center — theo dõi tx đang chờ theo chủ thể, không theo lời hứa
 * của UI.
 *
 * Vấn đề nó giải: tx phát đi có thể nằm im trong mempool hàng phút, hoặc bị
 * thay thế bằng speed-up/cancel. Nếu UI tắt spinner theo promise thì người
 * dùng đóng tab giữa chừng là mất dấu hoàn toàn.
 *
 * Khóa bản ghi là `${chainId}:${hash.toLowerCase()}` — bất biến dù tx có bị
 * replace (speed-up/cancel chỉ đổi nonce, không đổi hàm). Quét định kỳ trạng
 * thái thật trên chain, và chỉ invalidate đúng query liên quan khi có tx xong.
 */

export type TxStatus = 'pending' | 'success' | 'reverted' | 'replaced';

export interface TxRecord {
  key: string;
  chainId: number;
  hash: Address;
  /** Mô tả ngắn cho UI: "Swap USDC → WETH", "Gửi 0.5 ETH"… */
  summary: string;
  status: TxStatus;
  /** Tx thay thế (speed-up/cancel) — hash gốc vẫn là key. */
  replacedBy?: Address;
  createdAt: number;
  updatedAt: number;
}

export interface TransactionCenterOptions {
  pendingTtlMs?: number;
  sweepIntervalMs?: number;
  maxRecords?: number;
  /** Query key prefix nào được invalidate khi tx hoàn tất (mặc định: mọi thứ). */
  invalidatePrefixes?: string[][];
}

export interface TransactionCenterApi {
  /** Gọi ngay sau khi send — tx đi vào tầm quét. */
  track: (entry: { chainId: number; hash: Address; summary: string }) => void;
  records: TxRecord[];
  pendingCount: number;
  clearFinished: () => void;
}

const DEFAULT_OPTIONS: Required<Pick<TransactionCenterOptions, 'pendingTtlMs' | 'sweepIntervalMs' | 'maxRecords'>> = {
  pendingTtlMs: 30 * 60 * 1000,
  sweepIntervalMs: 20_000,
  maxRecords: 50,
};

async function fetchReceiptOnChain(chainId: number, hash: Address) {
  try {
    const client = getPublicClient(networkIdOf(chainId));
    const receipt = await client.getTransactionReceipt({ hash });
    if (!receipt) return null;
    return { status: receipt.status === 'success' ? 'success' as const : 'reverted' as const };
  } catch {
    return null;
  }
}

/**
 * Quét định kỳ mọi tx pending. Sau PENDING_TTL mà chưa có receipt thì coi như
 * bị bỏ rơi — đánh dấu `replaced` (tx cùng nonce khác có thể đã thay thế, hoặc
 * người dùng speed-up/cancel ngoài app).
 */
export function useTransactionCenter(options: TransactionCenterOptions = {}): TransactionCenterApi {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { isConnected } = useAccount();
  const queryClient = useQueryClient();

  const [records, setRecords] = useState<TxRecord[]>([]);
  const recordsRef = useRef(records);
  recordsRef.current = records;

  const invalidatePrefixesRef = useRef(options.invalidatePrefixes);
  invalidatePrefixesRef.current = options.invalidatePrefixes;

  const track = useCallback(
    (entry: { chainId: number; hash: Address; summary: string }) => {
      const key = `${entry.chainId}:${entry.hash.toLowerCase()}`;
      const now = Date.now();

      setRecords((prev) => {
        if (prev.some((record) => record.key === key)) return prev;
        const next: TxRecord[] = [
          {
            key,
            chainId: entry.chainId,
            hash: entry.hash,
            summary: entry.summary,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
          },
          ...prev,
        ];
        return next.slice(0, opts.maxRecords);
      });
    },
    [opts.maxRecords],
  );

  const sweep = useCallback(async () => {
    const now = Date.now();
    const pending = recordsRef.current.filter((record) => record.status === 'pending');
    if (pending.length === 0) return;

    const settled = await Promise.all(
      pending.map(async (record): Promise<TxRecord | null> => {
        if (now - record.createdAt > opts.pendingTtlMs) {
          return { ...record, status: 'replaced', updatedAt: now };
        }
        const receipt = await fetchReceiptOnChain(record.chainId, record.hash);
        if (!receipt) return null;
        return { ...record, status: receipt.status, updatedAt: now };
      }),
    );

    const updates = settled.filter((record): record is TxRecord => record !== null);
    if (updates.length === 0) return;

    setRecords((prev) =>
      prev.map((record) => updates.find((update) => update.key === record.key) ?? record),
    );

    // Tx hoàn tất ⇒ chỉ những query liên quan mới đổi. Invalidate có chọn lọc
    // thay vì phủ cả cache: token balance, lịch sử, allowance, gas.
    const prefixes = invalidatePrefixesRef.current;
    if (prefixes && prefixes.length > 0) {
      await Promise.all(prefixes.map((prefix) => queryClient.invalidateQueries({ queryKey: prefix })));
    } else {
      await queryClient.invalidateQueries();
    }
  }, [opts.pendingTtlMs, queryClient]);

  useEffect(() => {
    if (!isConnected) return;
    void sweep();
    const timer = window.setInterval(() => void sweep(), opts.sweepIntervalMs);
    return () => window.clearInterval(timer);
  }, [isConnected, opts.sweepIntervalMs, sweep]);

  const clearFinished = useCallback(() => {
    setRecords((prev) => prev.filter((record) => record.status === 'pending'));
  }, []);

  const pendingCount = useMemo(
    () => records.filter((record) => record.status === 'pending').length,
    [records],
  );

  return { track, records, pendingCount, clearFinished };
}
