import { useEffect, useState } from "react";

import {
  getSwapQuote,
  isSwapSupported,
  type DexToken,
  type SwapQuote,
} from "../lib/dex";
import { rpcOf } from "../lib/chains";

export function useSwapQuote(params: {
  chainId: number | undefined;
  tokenIn: DexToken | null;
  tokenOut: DexToken | null;
  amountIn: bigint;
  slippageBps: number;
  account: string | undefined;
  networkId?: string;
  enabled?: boolean;
}) {
  const [data, setData] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const ready =
    (params.enabled ?? true) &&
    Boolean(params.chainId && params.tokenIn && params.tokenOut && params.account) &&
    params.amountIn > 0n &&
    isSwapSupported(params.chainId);

  useEffect(() => {
    if (!ready) {
      setData(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const quote = await getSwapQuote(
          {
            chainId: params.chainId!,
            tokenIn: params.tokenIn!,
            tokenOut: params.tokenOut!,
            amountIn: params.amountIn,
            slippageBps: params.slippageBps,
            account: params.account! as `0x${string}`,
          },
          params.networkId ? rpcOf(params.networkId) : undefined,
        );
        if (!cancelled) setData(quote);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error("Quote failed"));
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const timer = setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [
    ready,
    params.chainId,
    params.tokenIn?.address,
    params.tokenOut?.address,
    params.amountIn.toString(),
    params.slippageBps,
    params.account,
    params.networkId,
  ]);

  return { data, loading, error };
}
