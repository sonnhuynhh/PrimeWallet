import { chainIdOf, explorerV2ApiOf, normalizeNetworkId } from '@/lib/wagmi/chains';

export interface EtherscanV2Response<T = unknown> {
  status: string;
  message: string;
  result: T;
}

/**
 * Gọi explorer API V2 đúng domain theo mạng (BscScan, PolygonScan…).
 * Một API key Etherscan dùng chung; BSC/Polygon/Base không gọi qua api.etherscan.io trên gói free.
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

  const response = await fetch(`${explorerV2ApiOf(networkId)}?${search.toString()}`);
  if (!response.ok) return null;
  return (await response.json()) as EtherscanV2Response<T>;
}
