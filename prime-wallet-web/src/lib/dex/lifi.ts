import { getAddress, type Address } from 'viem';
import { NATIVE_SENTINEL } from './constants';
import { SwapQuoteError, type QuoteRequest, type SwapQuote } from './types';

/**
 * Nguồn quote thứ hai: aggregator LI.FI (`li.quest/v1/quote`, không cần API key).
 *
 * Dùng cho eth_mainnet — nơi tự dựng routing engine vừa tốn RPC vừa không cạnh
 * tranh được với aggregator đã tổng hợp hàng chục DEX.
 *
 * Hai field trả `null` là CÓ Ý THỨC:
 * - `priceImpactPct`: LI.FI không trả mid price nên không tính trung thực được.
 * - `plan`: calldata của họ là hộp đen, không chèn `selfPermit` vào được.
 */

const LIFI_ENDPOINT = 'https://li.quest/v1/quote';

interface LifiEstimate {
  toAmount: string;
  toAmountMin: string;
  approvalAddress: string;
  fromAmountUSD?: string;
  toAmountUSD?: string;
  gasCosts?: { amountUSD?: string }[];
  tool?: string;
}

interface LifiResponse {
  tool?: string;
  estimate: LifiEstimate;
  transactionRequest?: {
    to?: string;
    data?: string;
    value?: string;
    gasLimit?: string;
  };
  message?: string;
}

function toNumberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBigIntOrZero(value: string | undefined): bigint {
  if (!value) return 0n;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

/** LI.FI dùng địa chỉ zero cho token gốc. */
function lifiAddress(address: Address): string {
  return getAddress(address) === getAddress(NATIVE_SENTINEL)
    ? '0x0000000000000000000000000000000000000000'
    : getAddress(address);
}

export async function quoteFromLifi(request: QuoteRequest): Promise<SwapQuote> {
  const params = new URLSearchParams({
    fromChain: String(request.chainId),
    toChain: String(request.chainId),
    fromToken: lifiAddress(request.tokenIn.address),
    toToken: lifiAddress(request.tokenOut.address),
    fromAddress: request.account,
    fromAmount: request.amountIn.toString(),
    slippage: (request.slippageBps / 10_000).toString(),
  });

  let response: Response;
  try {
    response = await fetch(`${LIFI_ENDPOINT}?${params.toString()}`, {
      headers: { accept: 'application/json' },
    });
  } catch {
    throw new SwapQuoteError('network', 'Không gọi được LI.FI. Kiểm tra kết nối mạng.');
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new SwapQuoteError('no-route', 'LI.FI không tìm được đường swap cho cặp token này.');
    }
    let detail = '';
    try {
      const body = (await response.json()) as LifiResponse;
      detail = body.message ?? '';
    } catch {
      /* body không phải JSON — bỏ qua */
    }
    throw new SwapQuoteError(
      'network',
      detail || `LI.FI trả lỗi ${response.status}. Thử lại sau ít phút.`,
    );
  }

  const data = (await response.json()) as LifiResponse;
  const tx = data.transactionRequest;
  if (!data.estimate || !tx?.to || !tx?.data) {
    throw new SwapQuoteError('no-route', 'LI.FI không trả về giao dịch hợp lệ.');
  }

  const gasUsd = data.estimate.gasCosts?.reduce<number | null>((acc, cost) => {
    const value = toNumberOrNull(cost.amountUSD);
    if (value === null) return acc;
    return (acc ?? 0) + value;
  }, null) ?? null;

  const gasLimit = toBigIntOrZero(tx.gasLimit);

  return {
    tool: `LI.FI · ${data.tool ?? data.estimate.tool ?? 'aggregator'}`,
    tokenIn: request.tokenIn,
    tokenOut: request.tokenOut,
    fromAmount: request.amountIn,
    toAmount: toBigIntOrZero(data.estimate.toAmount),
    toAmountMin: toBigIntOrZero(data.estimate.toAmountMin),
    approvalAddress: getAddress(data.estimate.approvalAddress ?? tx.to) as Address,

    fromAmountUsd: toNumberOrNull(data.estimate.fromAmountUSD),
    toAmountUsd: toNumberOrNull(data.estimate.toAmountUSD),
    gasUsd,

    // Có ý thức trả null — xem header file.
    priceImpactPct: null,
    lpFeePct: null,
    midRate: null,

    route: {
      hops: [
        {
          tokenIn: request.tokenIn.address,
          tokenOut: request.tokenOut.address,
          symbolIn: request.tokenIn.symbol,
          symbolOut: request.tokenOut.symbol,
          fee: null,
        },
      ],
      candidatesEvaluated: 1,
      source: 'aggregator',
    },
    plan: null,
    txRequest: {
      to: getAddress(tx.to) as Address,
      data: tx.data as `0x${string}`,
      value: toBigIntOrZero(tx.value),
      gasLimit: gasLimit > 0n ? gasLimit : 500_000n,
    },
  };
}
