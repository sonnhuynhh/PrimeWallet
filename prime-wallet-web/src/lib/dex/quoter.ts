import { decodeFunctionResult, encodeFunctionData, type PublicClient } from 'viem';
import { MULTICALL3_ADDRESS, MULTICALL_CHUNK, SEPOLIA_V3 } from './constants';
import { multicall3Abi, quoterV2Abi } from './abis';

/**
 * Báo giá hàng loạt — toàn bộ ứng viên trong MỘT request RPC.
 *
 * QuoterV2 gọi qua `aggregate3(allowFailure: true)`: route không có pool sẽ
 * revert lẻ mà không kéo chết cả batch. Batch quá MULTICALL_CHUNK thì chia nhỏ,
 * các batch chạy song song.
 */

export interface QuotedRoute {
  /** Chỉ số ứng viên trong mảng đầu vào — dùng để ghép lại với RouteCandidate. */
  index: number;
  path: `0x${string}`;
  amountOut: bigint;
  /** gas ước tính của route do chính Quoter trả. */
  gasEstimate: bigint;
}

export type QuoteSource =
  | { kind: 'ok'; routes: QuotedRoute[] }
  | { kind: 'failed'; message: string };

function quoteCalldata(path: `0x${string}`, amountIn: bigint) {
  return encodeFunctionData({
    abi: quoterV2Abi,
    functionName: 'quoteExactInput',
    args: [path, amountIn],
  });
}

function decodeQuote(data: `0x${string}`): { amountOut: bigint; gasEstimate: bigint } | null {
  try {
    const decoded = decodeFunctionResult({
      abi: quoterV2Abi,
      functionName: 'quoteExactInput',
      data,
    }) as readonly [bigint, readonly bigint[], readonly number[], bigint];
    return { amountOut: decoded[0], gasEstimate: decoded[3] };
  } catch {
    return null;
  }
}

/**
 * Báo giá mọi route, trả về route có thanh khoản (amountOut > 0), sắp theo
 * amountOut giảm dần. Trả `failed` chỉ khi RPC hỏng — khác hẳn với "không route
 * nào sống", vì quote fail lẻ là chuyện bình thường.
 */
export async function quoteAll(
  client: PublicClient,
  candidates: readonly { path: `0x${string}` }[],
  amountIn: bigint,
): Promise<QuoteSource> {
  if (candidates.length === 0 || amountIn <= 0n) {
    return { kind: 'ok', routes: [] };
  }

  try {
    /** Mỗi chunk giữ lại offset gốc để map kết quả về đúng ứng viên. */
    const chunks: { offset: number; items: readonly { path: `0x${string}` }[] }[] = [];
    for (let i = 0; i < candidates.length; i += MULTICALL_CHUNK) {
      chunks.push({ offset: i, items: candidates.slice(i, i + MULTICALL_CHUNK) });
    }

    const batches = await Promise.all(
      chunks.map(async (chunk) => {
        const results = await client.readContract({
          address: MULTICALL3_ADDRESS,
          abi: multicall3Abi,
          functionName: 'aggregate3',
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
    return { kind: 'ok', routes };
  } catch (error) {
    return {
      kind: 'failed',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
