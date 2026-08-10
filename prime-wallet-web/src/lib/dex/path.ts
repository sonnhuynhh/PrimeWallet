import { concat, getAddress, numberToHex, type Address } from 'viem';
import { FEE_TIERS, SEPOLIA_CONNECTORS, SEPOLIA_V3, NATIVE_SENTINEL, type DexToken } from './constants';

/**
 * Sinh ứng viên route + đóng gói path theo chuẩn Uniswap V3.
 *
 * Path V3 là bytes phẳng: token(20) | fee(3) | token(20) | fee(3) | token(20)…
 * Không có struct, không có độ dài — Quoter tự đọc theo bước 23 byte.
 */

export interface RouteCandidate {
  /** Chuỗi token theo đúng thứ tự đi qua (đã quy native → WETH). */
  tokens: Address[];
  /** Fee tier từng hop, length = tokens.length - 1. */
  fees: number[];
  /** Path đã encode, truyền thẳng cho `quoteExactInput`. */
  path: `0x${string}`;
  /**
   * Phí LP dồn qua nhiều chặng: 1 − Π(1 − fᵢ).
   * Nhân dồn, KHÔNG phải cộng — hai hop 0.3% là 0.5991%, không phải 0.6%.
   */
  cumulativeLpFeePct: number;
}

/** Quy native (ETH) về WETH — Uniswap chỉ giao dịch ERC-20. */
export function wrapNative(token: DexToken | Address, weth: Address = SEPOLIA_V3.weth9): Address {
  const address = typeof token === 'string' ? token : token.address;
  return getAddress(address) === getAddress(NATIVE_SENTINEL) ? weth : getAddress(address);
}

export function isNativeAddress(address: Address): boolean {
  return getAddress(address) === getAddress(NATIVE_SENTINEL);
}

/** Đóng gói path V3: token | fee(3 byte big-endian) | token | … */
export function encodePath(tokens: Address[], fees: number[]): `0x${string}` {
  if (tokens.length !== fees.length + 1) {
    throw new Error('encodePath: số token phải bằng số fee + 1');
  }

  const parts: `0x${string}`[] = [getAddress(tokens[0])];
  for (let i = 0; i < fees.length; i += 1) {
    parts.push(numberToHex(fees[i], { size: 3 }));
    parts.push(getAddress(tokens[i + 1]));
  }
  return concat(parts);
}

function lpFeeOf(fees: number[]): number {
  return 1 - fees.reduce((acc, fee) => acc * (1 - fee / 1_000_000), 1);
}

function candidate(tokens: Address[], fees: number[]): RouteCandidate {
  return {
    tokens,
    fees,
    path: encodePath(tokens, fees),
    cumulativeLpFeePct: lpFeeOf(fees),
  };
}

/**
 * Toàn bộ ứng viên cho một cặp: 1 hop × 4 fee + 2 hop qua từng connector × mọi
 * tổ hợp fee. Với 2 connector là 4 + 2×16 = 36 route.
 */
export function buildCandidates(
  tokenIn: Address,
  tokenOut: Address,
  connectors: Address[] = SEPOLIA_CONNECTORS,
): RouteCandidate[] {
  const from = wrapNative(tokenIn);
  const to = wrapNative(tokenOut);

  if (getAddress(from) === getAddress(to)) return [];

  const out: RouteCandidate[] = [];

  for (const fee of FEE_TIERS) {
    out.push(candidate([from, to], [fee]));
  }

  const seen = new Set([getAddress(from), getAddress(to)]);
  for (const raw of connectors) {
    const mid = getAddress(raw);
    if (seen.has(mid)) continue;

    for (const feeA of FEE_TIERS) {
      for (const feeB of FEE_TIERS) {
        out.push(candidate([from, mid, to], [feeA, feeB]));
      }
    }
  }

  return out;
}

/** Nhãn đường đi để hiển thị: "USDC → WETH → UNI". */
export function routeLabel(route: RouteCandidate, symbolOf: (address: Address) => string): string {
  return route.tokens.map((token) => symbolOf(token)).join(' → ');
}
