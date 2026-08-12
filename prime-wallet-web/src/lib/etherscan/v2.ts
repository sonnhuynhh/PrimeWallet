import { chainIdOf, ETHERSCAN_V2_API, normalizeNetworkId } from '@/lib/wagmi/chains';

export interface EtherscanV2Response<T = unknown> {
  status: string;
  message: string;
  result: T;
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    const text = await response.text();
    if (!text.trim() || text.trim().startsWith('<')) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Gọi Etherscan API V2 thống nhất (chainid chọn mạng).
 * @see https://docs.etherscan.io/v2-migration
 */
export async function fetchEtherscanV2<T = unknown>(
  networkId: string,
  params: Record<string, string>,
  apiKey?: string,
): Promise<EtherscanV2Response<T> | null> {
  const network = normalizeNetworkId(networkId);
  const search = new URLSearchParams({
    chainid: String(chainIdOf(network)),
    ...params,
  });
  if (apiKey) search.set('apikey', apiKey);

  try {
    const response = await fetch(`${ETHERSCAN_V2_API}?${search.toString()}`);
    if (!response.ok) return null;
    return await safeJson<EtherscanV2Response<T>>(response);
  } catch {
    return null;
  }
}
