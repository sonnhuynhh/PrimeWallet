import { ethers } from "ethers";

import { AGGREGATOR_CHAIN_ID, ENGINE_CHAIN_ID, SEPOLIA_TOKENS } from "./constants";
import { quoteFromEngine } from "./engine";
import { quoteFromLifi } from "./lifi";
import { createDexRpcClient } from "./rpcClient";
import { SwapQuoteError, type QuoteRequest, type SwapQuote } from "./types";

export * from "./constants";
export * from "./types";
export { buildCandidates, encodePath, isNativeAddress, routeLabel, wrapNative } from "./path";
export { quoteFromEngine } from "./engine";
export { quoteFromLifi } from "./lifi";
export { buildApproveCalldata, buildRevokeCalldata, needsSwapApproval } from "./approval";
export { feeLabel } from "./constants";

export async function getSwapQuote(
  request: QuoteRequest,
  rpcUrl?: string,
): Promise<SwapQuote> {
  if (request.chainId === AGGREGATOR_CHAIN_ID) {
    return quoteFromLifi(request);
  }

  if (request.chainId === ENGINE_CHAIN_ID) {
    const provider = new ethers.JsonRpcProvider(rpcUrl ?? "https://ethereum-sepolia-rpc.publicnode.com");
    const client = createDexRpcClient(provider);
    return quoteFromEngine(request, {
      client,
      knownTokens: SEPOLIA_TOKENS,
    });
  }

  throw new SwapQuoteError(
    "unsupported",
    "Mạng này chưa hỗ trợ swap. Chuyển sang Sepolia hoặc Ethereum mainnet.",
  );
}
