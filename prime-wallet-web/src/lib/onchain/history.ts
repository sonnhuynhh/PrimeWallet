import { chainIdOf, ETHERSCAN_V2_API, normalizeNetworkId, type NetworkId } from '@/lib/wagmi/chains';
import type { EtherscanTransaction } from '@/types/crypto';

/** URL explorer API legacy — chỉ dùng khi V2 không hỗ trợ (hiếm). */
const LEGACY_EXPLORER_API: Partial<Record<NetworkId, string>> = {};

function normalizeTxList(result: unknown): EtherscanTransaction[] {
  if (!Array.isArray(result)) return [];
  return result
    .filter((item): item is Record<string, string> => item && typeof item === 'object')
    .map((item) => ({
      hash: item.hash ?? '',
      from: item.from ?? '',
      to: item.to ?? '',
      value: item.value ?? '0',
      timeStamp: item.timeStamp ?? '0',
      isError: item.isError ?? '0',
    }))
    .filter((tx) => tx.hash);
}

/**
 * Fallback client-side: gọi Etherscan V2 (hoặc BscScan) khi backend trả rỗng.
 * Cần VITE_ETHERSCAN_API_KEY trong .env.local.
 */
export async function fetchOnChainTransactions(
  networkId: string,
  address: string,
  apiKey?: string,
): Promise<EtherscanTransaction[]> {
  if (!apiKey) return [];

  const network = normalizeNetworkId(networkId);
  const legacy = LEGACY_EXPLORER_API[network];
  const params = new URLSearchParams({
    module: 'account',
    action: 'txlist',
    address,
    startblock: '0',
    endblock: '99999999',
    page: '1',
    offset: '100',
    sort: 'desc',
    apikey: apiKey,
  });

  if (legacy) {
    const response = await fetch(`${legacy}?${params.toString()}`);
    if (!response.ok) return [];
    const body = (await response.json()) as { result?: unknown };
    return normalizeTxList(body.result);
  }

  params.set('chainid', String(chainIdOf(network)));
  const response = await fetch(`${ETHERSCAN_V2_API}?${params.toString()}`);
  if (!response.ok) return [];
  const body = (await response.json()) as { result?: unknown };
  return normalizeTxList(body.result);
}

/** Đảm bảo result luôn là mảng — backend/Etherscan đôi khi trả chuỗi. */
export function normalizeEtherscanResult(result: unknown): EtherscanTransaction[] {
  return normalizeTxList(result);
}
