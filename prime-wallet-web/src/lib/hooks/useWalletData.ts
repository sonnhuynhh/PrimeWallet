import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { getPublicClient } from '@/lib/wagmi/clients';
import { networkIdOf } from '@/lib/wagmi/chains';
import { alchemyApiKey, etherscanApiKey } from '@/lib/env';
import { scanAllowances, type AllowanceScanResult } from '@/lib/allowance/scan';
import { fetchNfts, type NftResult } from '@/lib/nft/nftService';

/**
 * Hook cho tab Quyền và tab NFT.
 *
 * Cả hai gọi API bên thứ ba (Etherscan/Alchemy) nên `staleTime` để dài — dữ
 * liệu chỉ đổi khi người dùng ký giao dịch, mà lúc đó Transaction Center đã
 * invalidate sẵn.
 */

export const ALLOWANCE_QUERY_KEY = ['allowances'] as const;
export const NFT_QUERY_KEY = ['nfts'] as const;

export function useAllowances(params: {
  chainId: number | undefined;
  owner: Address | undefined;
  knownTokens?: Address[];
  enabled?: boolean;
}) {
  const { chainId, owner } = params;
  const ready = (params.enabled ?? true) && Boolean(chainId && owner);

  return useQuery<AllowanceScanResult>({
    queryKey: [...ALLOWANCE_QUERY_KEY, chainId, owner, params.knownTokens?.join(',')],
    enabled: ready,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const networkId = networkIdOf(chainId!);
      return scanAllowances({
        client: getPublicClient(networkId),
        networkId,
        owner: owner!,
        knownTokens: params.knownTokens,
        etherscanApiKey: etherscanApiKey(),
      });
    },
  });
}

export function useNfts(params: {
  chainId: number | undefined;
  owner: Address | undefined;
  enabled?: boolean;
}) {
  const { chainId, owner } = params;
  const ready = (params.enabled ?? true) && Boolean(chainId && owner);

  return useQuery<NftResult>({
    queryKey: [...NFT_QUERY_KEY, chainId, owner],
    enabled: ready,
    staleTime: 120_000,
    retry: 1,
    queryFn: async () =>
      fetchNfts({
        networkId: networkIdOf(chainId!),
        owner: owner!,
        alchemyApiKey: alchemyApiKey(),
        etherscanApiKey: etherscanApiKey(),
      }),
  });
}
