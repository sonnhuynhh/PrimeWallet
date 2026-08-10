import { ethers } from "ethers";

import type { QuoteRequest, SwapQuote } from "./types";
import { SwapQuoteError } from "./types";
import { NATIVE_SENTINEL } from "./constants";

const LIFI_ENDPOINT = "https://li.quest/v1/quote";

function lifiAddress(address: string): string {
  return address.toLowerCase() === NATIVE_SENTINEL.toLowerCase()
    ? "0x0000000000000000000000000000000000000000"
    : ethers.getAddress(address);
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
    response = await fetch(`${LIFI_ENDPOINT}?${params}`, {
      headers: { accept: "application/json" },
    });
  } catch {
    throw new SwapQuoteError("network", "Không gọi được LI.FI. Kiểm tra kết nối mạng.");
  }

  if (!response.ok) {
    throw new SwapQuoteError("no-route", `LI.FI không tìm được đường swap (${response.status}).`);
  }

  const data = (await response.json()) as {
    tool?: string;
    message?: string;
    estimate?: {
      toAmount: string;
      toAmountMin: string;
      approvalAddress: string;
      fromAmountUSD?: string;
      toAmountUSD?: string;
      gasCosts?: { amountUSD?: string }[];
      tool?: string;
    };
    transactionRequest?: { to?: string; data?: string; value?: string; gasLimit?: string };
  };

  const tx = data.transactionRequest;
  if (!data.estimate || !tx?.to || !tx?.data) {
    throw new SwapQuoteError("no-route", data.message ?? "LI.FI không trả về giao dịch hợp lệ.");
  }

  const gasUsd =
    data.estimate.gasCosts?.reduce<number | null>((acc, cost) => {
      const value = cost.amountUSD ? Number(cost.amountUSD) : null;
      if (value === null || !Number.isFinite(value)) return acc;
      return (acc ?? 0) + value;
    }, null) ?? null;

  const gasLimit = BigInt(tx.gasLimit && tx.gasLimit !== "0" ? tx.gasLimit : "500000");

  return {
    tool: `LI.FI · ${data.tool ?? data.estimate.tool ?? "aggregator"}`,
    tokenIn: request.tokenIn,
    tokenOut: request.tokenOut,
    fromAmount: request.amountIn,
    toAmount: BigInt(data.estimate.toAmount),
    toAmountMin: BigInt(data.estimate.toAmountMin),
    approvalAddress: ethers.getAddress(data.estimate.approvalAddress ?? tx.to) as `0x${string}`,
    fromAmountUsd: data.estimate.fromAmountUSD ? Number(data.estimate.fromAmountUSD) : null,
    toAmountUsd: data.estimate.toAmountUSD ? Number(data.estimate.toAmountUSD) : null,
    gasUsd,
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
      source: "aggregator",
    },
    plan: null,
    txRequest: {
      to: ethers.getAddress(tx.to) as `0x${string}`,
      data: tx.data as `0x${string}`,
      value: BigInt(tx.value ?? "0"),
      gasLimit,
    },
  };
}
