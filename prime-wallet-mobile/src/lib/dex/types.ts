export type Address = `0x${string}`;

export interface DexToken {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  isNative?: boolean;
}

export interface RouteHop {
  tokenIn: Address;
  tokenOut: Address;
  symbolIn: string;
  symbolOut: string;
  fee: number | null;
}

export interface RoutePlan {
  hops: RouteHop[];
  candidatesEvaluated: number;
  source: "engine" | "aggregator";
}

export interface SwapCall {
  label: "selfPermit" | "exactInput" | "unwrapWETH9" | "refundETH";
  data: `0x${string}`;
}

export interface SwapPlan {
  deadline: bigint;
  calls: SwapCall[];
  supportsSelfPermit: boolean;
}

export interface TxRequest {
  to: Address;
  data: `0x${string}`;
  value: bigint;
  gasLimit: bigint;
}

export interface SwapQuote {
  tool: string;
  tokenIn: DexToken;
  tokenOut: DexToken;
  fromAmount: bigint;
  toAmount: bigint;
  toAmountMin: bigint;
  approvalAddress: Address;
  fromAmountUsd: number | null;
  toAmountUsd: number | null;
  gasUsd: number | null;
  priceImpactPct: number | null;
  lpFeePct: number | null;
  midRate: bigint | null;
  route: RoutePlan;
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

export class SwapQuoteError extends Error {
  readonly reason: "no-route" | "unsupported" | "network" | "invalid";

  constructor(reason: SwapQuoteError["reason"], message: string) {
    super(message);
    this.name = "SwapQuoteError";
    this.reason = reason;
  }
}
