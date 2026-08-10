import type { Address, DexToken } from "./types";

export const MULTICALL3_ADDRESS: Address = "0xcA11bde05977b3631167028862bE2a173976CA11";

export const SEPOLIA_V3 = {
  factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c" as Address,
  quoterV2: "0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3" as Address,
  swapRouter02: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E" as Address,
  weth9: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14" as Address,
} as const;

export const POOL_INIT_CODE_HASH =
  "0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54" as const;

export const FEE_TIERS = [100, 500, 3000, 10000] as const;

export const ADDRESS_THIS: Address = "0x0000000000000000000000000000000000000002";
export const MSG_SENDER: Address = "0x0000000000000000000000000000000000000001";

export const ROUTER_GAS_OVERHEAD = 46_000n;
export const SWAP_GAS_BUFFER = 80_000n;
export const GAS_LIMIT_NUM = 13n;
export const GAS_LIMIT_DEN = 10n;
export const DEADLINE_SECONDS = 20 * 60;

export const DEFAULT_SLIPPAGE_BPS = 50;
export const SLIPPAGE_PRESETS_BPS = [10, 50, 100, 300] as const;

export const POOL_PRICE_PROBE_LIMIT = 5;
export const MULTICALL_CHUNK = 40;

export const NATIVE_SENTINEL: Address = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const SEPOLIA_TOKENS: DexToken[] = [
  { address: NATIVE_SENTINEL, symbol: "ETH", name: "Ethereum", decimals: 18, isNative: true },
  { address: SEPOLIA_V3.weth9, symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
  {
    address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  {
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    symbol: "UNI",
    name: "Uniswap",
    decimals: 18,
  },
];

export const SEPOLIA_CONNECTORS: Address[] = [SEPOLIA_V3.weth9, "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"];

export const ENGINE_CHAIN_ID = 11155111;
export const AGGREGATOR_CHAIN_ID = 1;

export function isSwapSupported(chainId: number | undefined): boolean {
  return chainId === ENGINE_CHAIN_ID || chainId === AGGREGATOR_CHAIN_ID;
}

export function feeLabel(fee: number): string {
  return `${(fee / 10_000).toFixed(fee === 100 ? 2 : fee === 500 ? 2 : 1)}%`;
}
