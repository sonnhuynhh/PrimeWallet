import { getAddress, type Address, type PublicClient } from 'viem';
import {
  POOL_PRICE_PROBE_LIMIT,
  SEPOLIA_CONNECTORS,
  SEPOLIA_V3,
  type DexToken,
} from './constants';
import { buildCandidates, isNativeAddress, wrapNative, type RouteCandidate } from './path';
import { quoteAll } from './quoter';
import { midPriceScaled, priceImpactPct, readPoolPrices } from './pools';
import { applySlippage, execRateScaled, scoreRoutes, type ScoredRoute } from './score';
import { buildSwapPlan } from './calldata';
import { SwapQuoteError, type RouteHop, type SwapQuote, type QuoteRequest } from './types';

/**
 * Routing engine Uniswap V3 — 3 vòng RPC:
 *   1. gasPrice (song song với quote)
 *   2. quoteExactInput cho TOÀN BỘ ứng viên qua một Multicall3
 *   3. slot0 của top N route để tính price impact thật
 */

const PRECISION = 10n ** 18n;

function symbolResolver(tokens: DexToken[], tokenIn: DexToken, tokenOut: DexToken) {
  const map = new Map<string, string>();
  for (const token of [...tokens, tokenIn, tokenOut]) {
    map.set(getAddress(wrapNative(token.address)), token.symbol);
  }
  map.set(getAddress(SEPOLIA_V3.weth9), map.get(getAddress(SEPOLIA_V3.weth9)) ?? 'WETH');
  return (address: Address) => map.get(getAddress(address)) ?? `${address.slice(0, 6)}…`;
}

function hopsOf(
  candidate: RouteCandidate,
  symbolOf: (address: Address) => string,
): RouteHop[] {
  return candidate.fees.map((fee, i) => ({
    tokenIn: candidate.tokens[i],
    tokenOut: candidate.tokens[i + 1],
    symbolIn: symbolOf(candidate.tokens[i]),
    symbolOut: symbolOf(candidate.tokens[i + 1]),
    fee,
  }));
}

/**
 * Mid price của cả route = tích mid price từng hop.
 * Trả null nếu bất kỳ hop nào không đọc được pool — thà không có số hơn là số sai.
 */
async function routeMidRate(
  client: PublicClient,
  candidate: RouteCandidate,
  decimalsOf: (address: Address) => number,
): Promise<bigint | null> {
  const hops = candidate.fees.map((fee, i) => ({
    tokenIn: candidate.tokens[i],
    tokenOut: candidate.tokens[i + 1],
    fee,
  }));

  let prices;
  try {
    prices = await readPoolPrices(client, hops);
  } catch {
    return null;
  }

  let acc = PRECISION;
  for (let i = 0; i < hops.length; i += 1) {
    const price = prices[i];
    if (!price) return null;
    const hopRate = midPriceScaled(
      price.sqrtPriceX96,
      price.zeroForOne,
      decimalsOf(hops[i].tokenIn),
      decimalsOf(hops[i].tokenOut),
    );
    if (hopRate <= 0n) return null;
    acc = (acc * hopRate) / PRECISION;
  }
  return acc;
}

export interface EngineDeps {
  client: PublicClient;
  /** Danh sách token đã biết, dùng để tra symbol/decimals khi vẽ route. */
  knownTokens: DexToken[];
  connectors?: Address[];
}

export async function quoteFromEngine(
  request: QuoteRequest,
  deps: EngineDeps,
): Promise<SwapQuote> {
  const { client, knownTokens } = deps;
  const { tokenIn, tokenOut, amountIn, slippageBps, account } = request;

  if (amountIn <= 0n) {
    throw new SwapQuoteError('invalid', 'Nhập số lượng lớn hơn 0.');
  }

  const wrappedIn = wrapNative(tokenIn.address);
  const wrappedOut = wrapNative(tokenOut.address);
  if (getAddress(wrappedIn) === getAddress(wrappedOut)) {
    throw new SwapQuoteError('invalid', 'Hai token phải khác nhau.');
  }

  const candidates = buildCandidates(
    tokenIn.address,
    tokenOut.address,
    deps.connectors ?? SEPOLIA_CONNECTORS,
  );
  if (candidates.length === 0) {
    throw new SwapQuoteError('no-route', 'Không dựng được đường swap cho cặp token này.');
  }

  const [quoteResult, gasPriceWei] = await Promise.all([
    quoteAll(client, candidates, amountIn),
    client.getGasPrice().catch(() => 0n),
  ]);

  if (quoteResult.kind === 'failed') {
    throw new SwapQuoteError('network', 'Không lấy được báo giá từ mạng. Thử lại sau ít giây.');
  }
  if (quoteResult.routes.length === 0) {
    throw new SwapQuoteError(
      'no-route',
      'Không có pool nào đủ thanh khoản cho cặp token này trên Sepolia.',
    );
  }

  const decimalsMap = new Map<string, number>();
  for (const token of [...knownTokens, tokenIn, tokenOut]) {
    decimalsMap.set(getAddress(wrapNative(token.address)), token.decimals);
  }
  const decimalsOf = (address: Address) => decimalsMap.get(getAddress(address)) ?? 18;
  const symbolOf = symbolResolver(knownTokens, tokenIn, tokenOut);

  /**
   * Gas quy đổi sang tokenOut: nếu tokenOut chính là native/WETH thì tỷ giá là 1,
   * ngược lại lấy mid price WETH→tokenOut từ route tốt nhất nếu nó đi qua WETH.
   * Không suy ra được thì bỏ phần gas (nativePerTokenOutScaled = null) — chấm
   * theo amountOut thuần, thà thiếu chính xác hơn là dùng tỷ giá bịa.
   */
  const outIsNativeLike =
    isNativeAddress(tokenOut.address) ||
    getAddress(wrappedOut) === getAddress(SEPOLIA_V3.weth9);
  const nativePerTokenOutScaled = outIsNativeLike ? PRECISION : null;

  const scored = scoreRoutes(candidates, quoteResult.routes, {
    gasPriceWei,
    nativePerTokenOutScaled,
  });
  const best: ScoredRoute | undefined = scored[0];
  if (!best) {
    throw new SwapQuoteError('no-route', 'Không chấm điểm được route nào.');
  }

  // Vòng RPC thứ 3: chỉ đọc pool của route thắng (top N giới hạn chi phí).
  const probeTargets = scored.slice(0, POOL_PRICE_PROBE_LIMIT);
  const midRate = await routeMidRate(client, best.candidate, decimalsOf).catch(() => null);

  const execRate = execRateScaled(
    amountIn,
    best.quote.amountOut,
    tokenIn.decimals,
    tokenOut.decimals,
  );
  const impact =
    midRate === null ? null : priceImpactPct(execRate, midRate, best.candidate.cumulativeLpFeePct);

  const toAmountMin = applySlippage(best.quote.amountOut, slippageBps);

  const { plan, tx } = buildSwapPlan({
    path: best.candidate.path,
    amountIn,
    amountOutMinimum: toAmountMin,
    recipient: account,
    fromNative: isNativeAddress(tokenIn.address),
    toNative: isNativeAddress(tokenOut.address),
    quoterGasEstimate: best.quote.gasEstimate,
  });

  return {
    tool: 'Uniswap V3',
    tokenIn,
    tokenOut,
    fromAmount: amountIn,
    toAmount: best.quote.amountOut,
    toAmountMin,
    approvalAddress: SEPOLIA_V3.swapRouter02,

    // Engine không có nguồn giá USD — trả null thay vì bịa.
    fromAmountUsd: null,
    toAmountUsd: null,
    gasUsd: null,

    priceImpactPct: impact,
    lpFeePct: best.candidate.cumulativeLpFeePct,
    midRate,

    route: {
      hops: hopsOf(best.candidate, symbolOf),
      candidatesEvaluated: probeTargets.length > 0 ? quoteResult.routes.length : 0,
      source: 'engine',
    },
    plan,
    txRequest: tx,
  };
}
