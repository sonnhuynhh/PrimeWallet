import type { Address } from 'viem';

/**
 * Hằng số cho engine swap Uniswap V3 (Sepolia).
 *
 * Chỉ Sepolia có thanh khoản V3 thật trong số các mạng PrimeWallet hỗ trợ,
 * nên engine tự viết chỉ chạy ở đây. eth_mainnet dùng aggregator LI.FI.
 */

/** Multicall3 — cùng một địa chỉ trên mọi mạng EVM phổ biến. */
export const MULTICALL3_ADDRESS: Address = '0xcA11bde05977b3631167028862bE2a173976CA11';

/** Uniswap V3 trên Sepolia (đã xác minh). */
export const SEPOLIA_V3 = {
  factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c' as Address,
  quoterV2: '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3' as Address,
  swapRouter02: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E' as Address,
  weth9: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as Address,
} as const;

/** Init code hash của UniswapV3Pool — dùng để tính địa chỉ pool offline bằng CREATE2. */
export const POOL_INIT_CODE_HASH =
  '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54' as const;

/** Bốn fee tier chuẩn của V3, đơn vị phần triệu (1e6). */
export const FEE_TIERS = [100, 500, 3000, 10000] as const;
export type FeeTier = (typeof FEE_TIERS)[number];

/** Nhãn hiển thị cho fee tier. */
export function feeLabel(fee: number): string {
  return `${(fee / 10_000).toFixed(fee === 100 ? 2 : fee === 500 ? 2 : 1)}%`;
}

/**
 * Sentinel của SwapRouter02: recipient = chính router.
 * Dùng khi bán ra native — router giữ WETH rồi `unwrapWETH9` trả ETH về ví.
 */
export const ADDRESS_THIS: Address = '0x0000000000000000000000000000000000000002';
/** Sentinel: recipient = msg.sender. */
export const MSG_SENDER: Address = '0x0000000000000000000000000000000000000001';

/** Overhead gas của router, cộng vào khi chấm điểm best-execution. */
export const ROUTER_GAS_OVERHEAD = 46_000n;
/** Đệm gas khi dựng transaction thật. */
export const SWAP_GAS_BUFFER = 80_000n;
/** Hệ số nhân gasLimit (1.3x) — biểu diễn bằng phân số để tránh số thực. */
export const GAS_LIMIT_NUM = 13n;
export const GAS_LIMIT_DEN = 10n;

/** Hạn chót giao dịch: 20 phút. */
export const DEADLINE_SECONDS = 20 * 60;

/** Slippage mặc định: 0.5%. */
export const DEFAULT_SLIPPAGE_BPS = 50;
export const SLIPPAGE_PRESETS_BPS = [10, 50, 100, 300] as const;

/** Số route đọc slot0 để tính price impact (chỉ top N cho rẻ RPC). */
export const POOL_PRICE_PROBE_LIMIT = 5;
/** Số call tối đa trong một batch multicall. */
export const MULTICALL_CHUNK = 40;

export interface DexToken {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  /** true nếu đây là token gốc của chain (ETH), không phải ERC-20. */
  isNative?: boolean;
  logo?: string;
}

/** Token gốc — dùng chung cho mọi chain EVM trong app. */
export const NATIVE_SENTINEL: Address = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export const SEPOLIA_TOKENS: DexToken[] = [
  {
    address: NATIVE_SENTINEL,
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    isNative: true,
  },
  { address: SEPOLIA_V3.weth9, symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
  {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  {
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    symbol: 'UNI',
    name: 'Uniswap',
    decimals: 18,
  },
];

/**
 * Token trung gian khi dựng route 2 chặng.
 * Giữ danh sách ngắn: mỗi connector nhân số ứng viên lên ~16 route.
 */
export const SEPOLIA_CONNECTORS: Address[] = [
  SEPOLIA_V3.weth9,
  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
];

/** Chain id có engine tự viết. */
export const ENGINE_CHAIN_ID = 11155111;
/** Chain id dùng aggregator LI.FI. */
export const AGGREGATOR_CHAIN_ID = 1;

export function isSwapSupported(chainId: number | undefined): boolean {
  return chainId === ENGINE_CHAIN_ID || chainId === AGGREGATOR_CHAIN_ID;
}
