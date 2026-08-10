import type { Address } from 'viem';
import type { DexToken } from './constants';

/**
 * Hợp đồng chung cho MỌI nguồn quote.
 *
 * Engine Uniswap tự viết và aggregator LI.FI đều trả về đúng shape này, nên UI
 * không phải phân nhánh theo chain. Field nào nguồn không cung cấp được thì trả
 * `null` — không bịa số.
 */

export interface RouteHop {
  tokenIn: Address;
  tokenOut: Address;
  symbolIn: string;
  symbolOut: string;
  /** Fee tier (ppm) — null với aggregator vì calldata là hộp đen. */
  fee: number | null;
}

export interface RoutePlan {
  hops: RouteHop[];
  /** Số route đã chấm điểm — 1 với aggregator. */
  candidatesEvaluated: number;
  source: 'engine' | 'aggregator';
}

/** Một lệnh con trong `multicall` của SwapRouter02. */
export interface SwapCall {
  label: 'selfPermit' | 'exactInput' | 'unwrapWETH9' | 'refundETH';
  data: `0x${string}`;
}

export interface SwapPlan {
  deadline: bigint;
  calls: SwapCall[];
  /** Chỉ engine mới chèn được `selfPermit` vào cùng multicall. */
  supportsSelfPermit: boolean;
}

export interface TxRequest {
  to: Address;
  data: `0x${string}`;
  value: bigint;
  gasLimit: bigint;
}

export interface SwapQuote {
  /** Nhãn nguồn: "Uniswap V3" | "LI.FI · uniswap". */
  tool: string;
  tokenIn: DexToken;
  tokenOut: DexToken;
  fromAmount: bigint;
  toAmount: bigint;
  /** Đã áp slippage — chính là `amountOutMinimum` trong calldata. */
  toAmountMin: bigint;
  /** Contract cần được approve trước khi swap. */
  approvalAddress: Address;

  fromAmountUsd: number | null;
  toAmountUsd: number | null;
  gasUsd: number | null;

  /** Phân số (0.003 = 0.3%). null khi nguồn không tính trung thực được. */
  priceImpactPct: number | null;
  lpFeePct: number | null;
  /** Mid price scaled 1e18. */
  midRate: bigint | null;

  route: RoutePlan;
  /** null với aggregator — không chèn thêm call vào calldata của họ được. */
  plan: SwapPlan | null;
  txRequest: TxRequest;
}

export interface QuoteRequest {
  chainId: number;
  tokenIn: DexToken;
  tokenOut: DexToken;
  amountIn: bigint;
  slippageBps: number;
  account: Address;
}

/** Lỗi quote có thông điệp tiếng Việt sẵn cho UI. */
export class SwapQuoteError extends Error {
  readonly reason: 'no-route' | 'unsupported' | 'network' | 'invalid';

  constructor(reason: SwapQuoteError['reason'], message: string) {
    super(message);
    this.name = 'SwapQuoteError';
    this.reason = reason;
  }
}
