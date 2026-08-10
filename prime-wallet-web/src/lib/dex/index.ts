import { AGGREGATOR_CHAIN_ID, ENGINE_CHAIN_ID, SEPOLIA_TOKENS } from './constants';
import { quoteFromEngine, type EngineDeps } from './engine';
import { quoteFromLifi } from './lifi';
import { SwapQuoteError, type QuoteRequest, type SwapQuote } from './types';

export * from './constants';
export * from './types';
export { buildCandidates, encodePath, isNativeAddress, routeLabel, wrapNative } from './path';
export { computePoolAddress, midPriceScaled, priceImpactPct } from './pools';
export { applySlippage, execRateScaled, scoreRoutes } from './score';
export { buildSwapPlan, type PermitSignature } from './calldata';
export { quoteFromEngine } from './engine';
export { quoteFromLifi } from './lifi';
export { buildApproveCalldata, needsSwapApproval } from './approval';

/**
 * Điểm vào duy nhất cho UI: chọn nguồn quote theo chain.
 *
 * | Chain              | Nguồn                        |
 * |--------------------|------------------------------|
 * | 11155111 (Sepolia) | engine Uniswap V3 tự viết    |
 * | 1 (mainnet)        | aggregator LI.FI             |
 */
export async function getSwapQuote(
  request: QuoteRequest,
  deps: Pick<EngineDeps, 'client'> & Partial<Pick<EngineDeps, 'knownTokens' | 'connectors'>>,
): Promise<SwapQuote> {
  if (request.chainId === AGGREGATOR_CHAIN_ID) {
    return quoteFromLifi(request);
  }

  if (request.chainId === ENGINE_CHAIN_ID) {
    return quoteFromEngine(request, {
      client: deps.client,
      knownTokens: deps.knownTokens ?? SEPOLIA_TOKENS,
      connectors: deps.connectors,
    });
  }

  throw new SwapQuoteError(
    'unsupported',
    'Mạng này chưa hỗ trợ swap. Chuyển sang Sepolia hoặc Ethereum mainnet.',
  );
}
