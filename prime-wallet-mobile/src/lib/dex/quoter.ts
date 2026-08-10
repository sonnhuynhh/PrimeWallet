import { MULTICALL3_ADDRESS, MULTICALL_CHUNK, SEPOLIA_V3 } from "./constants";
import { multicall3Abi, quoterV2Abi } from "./abis";
import type { DexRpcClient } from "./rpcClient";
import { decodeFunctionResult, encodeFunctionData } from "./rpcClient";

export interface QuotedRoute {
  index: number;
  path: `0x${string}`;
  amountOut: bigint;
  gasEstimate: bigint;
}

export type QuoteSource = { kind: "ok"; routes: QuotedRoute[] } | { kind: "failed"; message: string };

function quoteCalldata(path: `0x${string}`, amountIn: bigint) {
  return encodeFunctionData(quoterV2Abi, "quoteExactInput", [path, amountIn]);
}

function decodeQuote(data: `0x${string}`): { amountOut: bigint; gasEstimate: bigint } | null {
  try {
    const decoded = decodeFunctionResult<readonly [bigint, readonly bigint[], readonly number[], bigint]>(
      quoterV2Abi,
      "quoteExactInput",
      data,
    );
    return { amountOut: decoded[0], gasEstimate: decoded[3] };
  } catch {
    return null;
  }
}

export async function quoteAll(
  client: DexRpcClient,
  candidates: readonly { path: `0x${string}` }[],
  amountIn: bigint,
): Promise<QuoteSource> {
  if (candidates.length === 0 || amountIn <= 0n) {
    return { kind: "ok", routes: [] };
  }

  try {
    const chunks: { offset: number; items: readonly { path: `0x${string}` }[] }[] = [];
    for (let i = 0; i < candidates.length; i += MULTICALL_CHUNK) {
      chunks.push({ offset: i, items: candidates.slice(i, i + MULTICALL_CHUNK) });
    }

    const batches = await Promise.all(
      chunks.map(async (chunk) => {
        const results = await client.readContract<
          readonly { success: boolean; returnData: `0x${string}` }[]
        >({
          address: MULTICALL3_ADDRESS,
          abi: multicall3Abi,
          functionName: "aggregate3",
          args: [
            chunk.items.map((item) => ({
              target: SEPOLIA_V3.quoterV2,
              allowFailure: true,
              callData: quoteCalldata(item.path, amountIn),
            })),
          ],
        });
        return { offset: chunk.offset, results };
      }),
    );

    const routes: QuotedRoute[] = [];
    for (const batch of batches) {
      batch.results.forEach((result, i) => {
        if (!result.success) return;
        const quote = decodeQuote(result.returnData);
        if (!quote || quote.amountOut === 0n) return;
        const index = batch.offset + i;
        routes.push({
          index,
          path: candidates[index].path,
          amountOut: quote.amountOut,
          gasEstimate: quote.gasEstimate,
        });
      });
    }

    routes.sort((a, b) => (a.amountOut === b.amountOut ? 0 : a.amountOut > b.amountOut ? -1 : 1));
    return { kind: "ok", routes };
  } catch (error) {
    return { kind: "failed", message: error instanceof Error ? error.message : String(error) };
  }
}
