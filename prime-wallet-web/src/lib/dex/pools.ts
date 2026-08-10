import {
  encodeAbiParameters,
  encodeFunctionData,
  decodeFunctionResult,
  getAddress,
  keccak256,
  concat,
  pad,
  slice,
  type Address,
  type PublicClient,
} from 'viem';
import { MULTICALL3_ADDRESS, POOL_INIT_CODE_HASH, SEPOLIA_V3 } from './constants';
import { multicall3Abi, uniswapV3PoolAbi } from './abis';

/**
 * Địa chỉ pool + mid price.
 *
 * Pool address tính offline bằng CREATE2 nên không phải gọi `factory.getPool`
 * cho từng hop — tiết kiệm hẳn một vòng RPC cho mỗi cặp fee tier.
 */

/** Sắp cặp token theo thứ tự Uniswap dùng (địa chỉ nhỏ hơn là token0). */
export function sortTokens(tokenA: Address, tokenB: Address): [Address, Address] {
  const a = getAddress(tokenA);
  const b = getAddress(tokenB);
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}

/**
 * CREATE2: address = keccak256(0xff ++ factory ++ salt ++ initCodeHash)[12:]
 * với salt = keccak256(abi.encode(token0, token1, fee)).
 */
export function computePoolAddress(
  tokenA: Address,
  tokenB: Address,
  fee: number,
  factory: Address = SEPOLIA_V3.factory,
): Address {
  const [token0, token1] = sortTokens(tokenA, tokenB);

  const salt = keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'address' }, { type: 'uint24' }],
      [token0, token1, fee],
    ),
  );

  const hash = keccak256(
    concat(['0xff', getAddress(factory), salt, POOL_INIT_CODE_HASH]),
  );

  return getAddress(slice(hash, 12));
}

export interface PoolPrice {
  pool: Address;
  sqrtPriceX96: bigint;
  /** true nếu tokenIn của hop là token0 của pool. */
  zeroForOne: boolean;
}

const Q192 = 1n << 192n;
/** Ngưỡng nhiễu dấu phẩy động — dưới mức này coi như impact bằng 0 (1e-9 = 1e-7%). */
const IMPACT_EPSILON = 1e-9;
/** Thang cố định để giữ độ chính xác khi chia bigint (18 chữ số thập phân). */
const PRECISION = 10n ** 18n;

/**
 * Mid price của một hop, trả về dạng phân số scaled 1e18:
 * "1 tokenIn đổi được bao nhiêu tokenOut" × 1e18.
 *
 * sqrtPriceX96 biểu diễn √(token1/token0) × 2^96 theo đơn vị raw (chưa chia
 * decimals), nên phải hiệu chỉnh decimals ở ngoài.
 */
export function midPriceScaled(
  sqrtPriceX96: bigint,
  zeroForOne: boolean,
  decimalsIn: number,
  decimalsOut: number,
): bigint {
  if (sqrtPriceX96 <= 0n) return 0n;

  // price(token1 theo token0) raw = sqrtPriceX96² / 2^192
  const numerator = sqrtPriceX96 * sqrtPriceX96;

  // raw ratio scaled 1e18
  const rawScaled = zeroForOne
    ? (numerator * PRECISION) / Q192
    : (Q192 * PRECISION) / numerator;

  // Hiệu chỉnh decimals: nhân 10^decimalsIn, chia 10^decimalsOut
  return (rawScaled * 10n ** BigInt(decimalsIn)) / 10n ** BigInt(decimalsOut);
}

/**
 * Đọc slot0 của nhiều pool trong một request.
 * Pool chưa khởi tạo sẽ fail lẻ → trả null cho phần tử đó.
 */
export async function readPoolPrices(
  client: PublicClient,
  hops: { tokenIn: Address; tokenOut: Address; fee: number }[],
): Promise<(PoolPrice | null)[]> {
  if (hops.length === 0) return [];

  const targets = hops.map((hop) => {
    const pool = computePoolAddress(hop.tokenIn, hop.tokenOut, hop.fee);
    const [token0] = sortTokens(hop.tokenIn, hop.tokenOut);
    return { pool, zeroForOne: getAddress(hop.tokenIn) === token0 };
  });

  const results = await client.readContract({
    address: MULTICALL3_ADDRESS,
    abi: multicall3Abi,
    functionName: 'aggregate3',
    args: [
      targets.map((target) => ({
        target: target.pool,
        allowFailure: true,
        callData: encodeFunctionData({ abi: uniswapV3PoolAbi, functionName: 'slot0' }),
      })),
    ],
  });

  return results.map((result, i) => {
    if (!result.success) return null;
    try {
      const decoded = decodeFunctionResult({
        abi: uniswapV3PoolAbi,
        functionName: 'slot0',
        data: result.returnData,
      }) as readonly [bigint, number, number, number, number, number, boolean];
      const sqrtPriceX96 = decoded[0];
      if (sqrtPriceX96 <= 0n) return null;
      return { pool: targets[i].pool, sqrtPriceX96, zeroForOne: targets[i].zeroForOne };
    } catch {
      return null;
    }
  });
}

/**
 * Price impact thật: `impact = (1 − exec/mid) − lpFee`, floor ở 0.
 *
 * Trừ phí LP để impact chỉ phản ánh độ trượt giá do thanh khoản mỏng, không lẫn
 * phần phí — nếu không trừ, một swap hoàn hảo qua pool 1% vẫn báo impact 1%.
 *
 * @param execScaled  tỷ giá thực thi (amountOut/amountIn) đã scale 1e18
 * @param midScaled   mid price đã scale 1e18
 * @param lpFeePct    phí LP dồn, dạng phân số (0.003 = 0.3%)
 */
export function priceImpactPct(
  execScaled: bigint,
  midScaled: bigint,
  lpFeePct: number,
): number | null {
  if (midScaled <= 0n || execScaled <= 0n) return null;

  const ratio = Number(execScaled) / Number(midScaled);
  if (!Number.isFinite(ratio)) return null;

  const impact = 1 - ratio - lpFeePct;
  // Floor cả nhiễu dấu phẩy động: phép trừ trên hai số ~1 để lại rác cỡ 1e-18,
  // đủ để UI hiện badge impact khác 0 dù thực chất là 0.
  return impact > IMPACT_EPSILON ? impact : 0;
}

/** Padding helper dùng cho state override (xem simulate.ts). */
export function slotKey(...parts: `0x${string}`[]): `0x${string}` {
  return keccak256(concat(parts.map((part) => pad(part, { size: 32 }))));
}
