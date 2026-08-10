import { ROUTER_GAS_OVERHEAD } from './constants';
import type { RouteCandidate } from './path';
import type { QuotedRoute } from './quoter';

/**
 * Chấm điểm best-execution.
 *
 * Không chọn route có `amountOut` lớn nhất, mà chọn route có **output ròng** lớn
 * nhất sau khi trừ gas quy đổi sang tokenOut:
 *
 *   net = amountOut − (gasEstimate + ROUTER_GAS_OVERHEAD) × gasPrice → tokenOut
 *
 * Đây là chỗ engine hành xử như aggregator thật: route 2 chặng chỉ thắng khi
 * phần output tăng thêm bù được phần gas tăng thêm.
 */

export interface ScoredRoute {
  candidate: RouteCandidate;
  quote: QuotedRoute;
  /** Output ròng sau khi trừ chi phí gas, đơn vị tokenOut (raw). */
  netAmountOut: bigint;
  /** Chi phí gas quy đổi sang tokenOut (raw), 0n nếu không quy đổi được. */
  gasCostInTokenOut: bigint;
  /** Tổng gas dùng để chấm điểm. */
  gasTotal: bigint;
}

export interface ScoreContext {
  gasPriceWei: bigint;
  /**
   * Tỷ giá 1 wei native → bao nhiêu đơn vị raw tokenOut, scaled 1e18.
   * null khi không xác định được (thiếu pool) → bỏ phần gas, chấm theo amountOut.
   */
  nativePerTokenOutScaled: bigint | null;
}

const PRECISION = 10n ** 18n;

/** Quy chi phí gas (wei) sang đơn vị raw của tokenOut. */
export function gasCostInTokenOut(
  gasTotal: bigint,
  gasPriceWei: bigint,
  nativePerTokenOutScaled: bigint | null,
): bigint {
  if (nativePerTokenOutScaled === null || nativePerTokenOutScaled <= 0n) return 0n;
  const gasWei = gasTotal * gasPriceWei;
  return (gasWei * nativePerTokenOutScaled) / PRECISION;
}

/**
 * Ghép quote với candidate, tính net, sắp xếp giảm dần theo net.
 * Route nào net ≤ 0 vẫn giữ lại (người dùng có quyền biết), chỉ xếp sau.
 */
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
      const gasCost = gasCostInTokenOut(
        gasTotal,
        context.gasPriceWei,
        context.nativePerTokenOutScaled,
      );

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
    // Net bằng nhau → ưu tiên route ít hop hơn (ít rủi ro thực thi).
    return a.candidate.fees.length - b.candidate.fees.length;
  });

  return scored;
}

/** Tỷ giá thực thi (amountOut/amountIn) scaled 1e18, đã hiệu chỉnh decimals. */
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

/** amountOutMinimum từ slippage (basis points). */
export function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.min(10_000, Math.round(slippageBps))));
  return (amountOut * (10_000n - bps)) / 10_000n;
}
