import { ROUTER_GAS_OVERHEAD } from "./constants";
import type { RouteCandidate } from "./path";
import type { QuotedRoute } from "./quoter";

export interface ScoredRoute {
  candidate: RouteCandidate;
  quote: QuotedRoute;
  netAmountOut: bigint;
  gasCostInTokenOut: bigint;
  gasTotal: bigint;
}

export interface ScoreContext {
  gasPriceWei: bigint;
  nativePerTokenOutScaled: bigint | null;
}

const PRECISION = 10n ** 18n;

export function gasCostInTokenOut(
  gasTotal: bigint,
  gasPriceWei: bigint,
  nativePerTokenOutScaled: bigint | null,
): bigint {
  if (nativePerTokenOutScaled === null || nativePerTokenOutScaled <= 0n) return 0n;
  const gasWei = gasTotal * gasPriceWei;
  return (gasWei * nativePerTokenOutScaled) / PRECISION;
}

export function scoreRoutes(
  candidates: readonly RouteCandidate[],
  quotes: readonly QuotedRoute[],
  context: ScoreContext,
): ScoredRoute[] {
  const scored = quotes
    .map((quote) => {
      const candidate = candidates[quote.index];
      if (!candidate) return null;
      const gasTotal = quote.gasEstimate + ROUTER_GAS_OVERHEAD;
      const gasCost = gasCostInTokenOut(gasTotal, context.gasPriceWei, context.nativePerTokenOutScaled);
      return {
        candidate,
        quote,
        gasTotal,
        gasCostInTokenOut: gasCost,
        netAmountOut: quote.amountOut - gasCost,
      } satisfies ScoredRoute;
    })
    .filter((route): route is ScoredRoute => route !== null);

  scored.sort((a, b) => {
    if (a.netAmountOut !== b.netAmountOut) return a.netAmountOut > b.netAmountOut ? -1 : 1;
    return a.candidate.fees.length - b.candidate.fees.length;
  });
  return scored;
}

export function execRateScaled(
  amountIn: bigint,
  amountOut: bigint,
  decimalsIn: number,
  decimalsOut: number,
): bigint {
  if (amountIn <= 0n) return 0n;
  const scaled = (amountOut * PRECISION * 10n ** BigInt(decimalsIn)) / amountIn;
  return scaled / 10n ** BigInt(decimalsOut);
}

export function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.min(10_000, Math.round(slippageBps))));
  return (amountOut * (10_000n - bps)) / 10_000n;
}
