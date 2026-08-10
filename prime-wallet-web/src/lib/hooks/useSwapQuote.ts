import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { getPublicClient } from '@/lib/wagmi/clients';
import { networkIdOf } from '@/lib/wagmi/chains';
import { getSwapQuote, isSwapSupported, type DexToken, type SwapQuote } from '@/lib/dex';

/**
 * Quote swap — một hook, hai nguồn (engine Sepolia / aggregator LI.FI).
 *
 * `staleTime` 15s + `refetchInterval` 20s: giá on-chain đổi liên tục, quote cũ
 * dễ trượt lúc execute. `slippageBps` nằm trong queryKey vì nó được áp thẳng
 * vào `amountOutMin` trong calldata — đổi slippage là đổi giao dịch.
 */

export interface UseSwapQuoteParams {
  chainId: number | undefined;
  tokenIn: DexToken | null;
  tokenOut: DexToken | null;
  amountIn: bigint;
  slippageBps: number;
  account: Address | undefined;
  knownTokens?: DexToken[];
  enabled?: boolean;
}

export function useSwapQuote(params: UseSwapQuoteParams) {
  const { chainId, tokenIn, tokenOut, amountIn, slippageBps, account } = params;

  const ready =
    (params.enabled ?? true) &&
    Boolean(chainId && tokenIn && tokenOut && account) &&
    amountIn > 0n &&
    isSwapSupported(chainId);

  return useQuery<SwapQuote>({
    queryKey: [
      'swap-quote',
      chainId,
      tokenIn?.address,
      tokenOut?.address,
      amountIn.toString(),
      slippageBps,
      account,
    ],
    enabled: ready,
    staleTime: 15_000,
    refetchInterval: 20_000,
    // Quote hỏng thường do thiếu thanh khoản, thử lại cũng thế — chỉ retry 1 lần cho lỗi mạng.
    retry: 1,
    queryFn: async () => {
      const client = getPublicClient(networkIdOf(chainId!));
      return getSwapQuote(
        {
          chainId: chainId!,
          tokenIn: tokenIn!,
          tokenOut: tokenOut!,
          amountIn,
          slippageBps,
          account: account!,
        },
        { client, knownTokens: params.knownTokens },
      );
    },
  });
}
