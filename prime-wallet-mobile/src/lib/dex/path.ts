import {
  FEE_TIERS,
  SEPOLIA_CONNECTORS,
  SEPOLIA_V3,
  NATIVE_SENTINEL,
} from "./constants";
import type { DexToken } from "./types";
import type { Address } from "./types";
import { concatHex, feeToHex3, getAddress } from "./rpcClient";

export interface RouteCandidate {
  tokens: Address[];
  fees: number[];
  path: `0x${string}`;
  cumulativeLpFeePct: number;
}

export function wrapNative(token: DexToken | Address, weth: Address = SEPOLIA_V3.weth9): Address {
  const address = typeof token === "string" ? token : token.address;
  return getAddress(address) === getAddress(NATIVE_SENTINEL) ? weth : getAddress(address);
}

export function isNativeAddress(address: Address): boolean {
  return getAddress(address) === getAddress(NATIVE_SENTINEL);
}

export function encodePath(tokens: Address[], fees: number[]): `0x${string}` {
  if (tokens.length !== fees.length + 1) {
    throw new Error("encodePath: số token phải bằng số fee + 1");
  }
  const parts: `0x${string}`[] = [getAddress(tokens[0])];
  for (let i = 0; i < fees.length; i += 1) {
    parts.push(feeToHex3(fees[i]));
    parts.push(getAddress(tokens[i + 1]));
  }
  return concatHex(parts);
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

export function routeLabel(route: RouteCandidate, symbolOf: (address: Address) => string): string {
  return route.tokens.map((token) => symbolOf(token)).join(" → ");
}
