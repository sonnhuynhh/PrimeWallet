import { ethers } from "ethers";

import { MULTICALL3_ADDRESS, POOL_INIT_CODE_HASH, SEPOLIA_V3 } from "./constants";
import { multicall3Abi, uniswapV3PoolAbi } from "./abis";
import type { Address } from "./types";
import type { DexRpcClient } from "./rpcClient";
import {
  concatHex,
  decodeFunctionResult,
  encodeFunctionData,
  encodePoolSalt,
  getAddress,
  keccak256,
} from "./rpcClient";

export function sortTokens(tokenA: Address, tokenB: Address): [Address, Address] {
  const a = getAddress(tokenA);
  const b = getAddress(tokenB);
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}

export function computePoolAddress(
  tokenA: Address,
  tokenB: Address,
  fee: number,
  factory: Address = SEPOLIA_V3.factory,
): Address {
  const [token0, token1] = sortTokens(tokenA, tokenB);
  const salt = keccak256(encodePoolSalt(token0, token1, fee));
  const hash = keccak256(
    concatHex(["0xff", getAddress(factory), salt, POOL_INIT_CODE_HASH]),
  );
  return ethers.getAddress("0x" + hash.slice(-40)) as Address;
}

export interface PoolPrice {
  pool: Address;
  sqrtPriceX96: bigint;
  zeroForOne: boolean;
}

const Q192 = 1n << 192n;
const IMPACT_EPSILON = 1e-9;
const PRECISION = 10n ** 18n;

export function midPriceScaled(
  sqrtPriceX96: bigint,
  zeroForOne: boolean,
  decimalsIn: number,
  decimalsOut: number,
): bigint {
  if (sqrtPriceX96 <= 0n) return 0n;
  const numerator = sqrtPriceX96 * sqrtPriceX96;
  const rawScaled = zeroForOne ? (numerator * PRECISION) / Q192 : (Q192 * PRECISION) / numerator;
  return (rawScaled * 10n ** BigInt(decimalsIn)) / 10n ** BigInt(decimalsOut);
}

export async function readPoolPrices(
  client: DexRpcClient,
  hops: { tokenIn: Address; tokenOut: Address; fee: number }[],
): Promise<(PoolPrice | null)[]> {
  if (hops.length === 0) return [];

  const targets = hops.map((hop) => {
    const pool = computePoolAddress(hop.tokenIn, hop.tokenOut, hop.fee);
    const [token0] = sortTokens(hop.tokenIn, hop.tokenOut);
    return { pool, zeroForOne: getAddress(hop.tokenIn) === token0 };
  });

  const results = await client.readContract<
    readonly { success: boolean; returnData: `0x${string}` }[]
  >({
    address: MULTICALL3_ADDRESS,
    abi: multicall3Abi,
    functionName: "aggregate3",
    args: [
      targets.map((target) => ({
        target: target.pool,
        allowFailure: true,
        callData: encodeFunctionData(uniswapV3PoolAbi, "slot0", []),
      })),
    ],
  });

  return results.map((result, i) => {
    if (!result.success) return null;
    try {
      const decoded = decodeFunctionResult<readonly [bigint, number, number, number, number, number, boolean]>(
        uniswapV3PoolAbi,
        "slot0",
        result.returnData,
      );
      const sqrtPriceX96 = decoded[0];
      if (sqrtPriceX96 <= 0n) return null;
      return { pool: targets[i].pool, sqrtPriceX96, zeroForOne: targets[i].zeroForOne };
    } catch {
      return null;
    }
  });
}

export function priceImpactPct(execScaled: bigint, midScaled: bigint, lpFeePct: number): number | null {
  if (midScaled <= 0n || execScaled <= 0n) return null;
  const ratio = Number(execScaled) / Number(midScaled);
  if (!Number.isFinite(ratio)) return null;
  const impact = 1 - ratio - lpFeePct;
  return impact > IMPACT_EPSILON ? impact : 0;
}
