import { defineChain } from 'viem';
import { mainnet, sepolia, bsc, polygon, base } from 'viem/chains';
import type { Chain } from 'viem';

/**
 * Ánh xạ mạng backend → `Chain` viem.
 * Chỉ Sepolia là testnet; BSC / Polygon / Base dùng mainnet.
 */

export const NETWORK_TO_CHAIN_ID = {
  eth_mainnet: 1,
  eth_sepolia: 11155111,
  bsc_mainnet: 56,
  polygon_mainnet: 137,
  base_mainnet: 8453,
} as const;

export type NetworkId = keyof typeof NETWORK_TO_CHAIN_ID;

/** Alias cũ (testnet) → id mới — ví đã liên kết trước đây vẫn map đúng chain. */
export const LEGACY_NETWORK_ALIASES: Record<string, NetworkId> = {
  bsc_testnet: 'bsc_mainnet',
  polygon_amoy: 'polygon_mainnet',
  base_sepolia: 'base_mainnet',
};

export const CHAIN_ID_TO_NETWORK: Record<number, NetworkId> = Object.fromEntries(
  Object.entries(NETWORK_TO_CHAIN_ID).map(([k, v]) => [v, k as NetworkId]),
) as Record<number, NetworkId>;

export const FALLBACK_RPC: Record<NetworkId, string> = {
  eth_mainnet: 'https://eth.llamarpc.com',
  eth_sepolia: 'https://ethereum-sepolia-rpc.publicnode.com',
  bsc_mainnet: 'https://bsc-dataseed.binance.org',
  polygon_mainnet: 'https://polygon-rpc.com',
  base_mainnet: 'https://mainnet.base.org',
};

export const FALLBACK_EXPLORER: Record<NetworkId, string> = {
  eth_mainnet: 'https://etherscan.io',
  eth_sepolia: 'https://sepolia.etherscan.io',
  bsc_mainnet: 'https://bscscan.com',
  polygon_mainnet: 'https://polygonscan.com',
  base_mainnet: 'https://basescan.org',
};

export const ETHERSCAN_V2_API = 'https://api.etherscan.io/v2/api';

/**
 * Endpoint V2 theo từng explorer — BSC/Polygon/Base cần gọi đúng domain
 * (gói miễn phí không hỗ trợ các chain này qua api.etherscan.io/v2).
 * @see https://docs.etherscan.io/v2-migration
 */
export const EXPLORER_V2_API: Record<NetworkId, string> = {
  eth_mainnet: 'https://api.etherscan.io/v2/api',
  eth_sepolia: 'https://api.etherscan.io/v2/api',
  bsc_mainnet: 'https://api.bscscan.com/v2/api',
  polygon_mainnet: 'https://api.polygonscan.com/v2/api',
  base_mainnet: 'https://api.basescan.org/v2/api',
};

export function explorerV2ApiOf(networkId: string): string {
  const id = normalizeNetworkId(networkId);
  return EXPLORER_V2_API[id] ?? ETHERSCAN_V2_API;
}

export const SUPPORTS_LOG_SCAN: Record<NetworkId, boolean> = {
  eth_mainnet: true,
  eth_sepolia: true,
  bsc_mainnet: true,
  polygon_mainnet: true,
  base_mainnet: true,
};

export const CHAINS: Record<NetworkId, Chain> = {
  eth_mainnet: mainnet,
  eth_sepolia: sepolia,
  bsc_mainnet: bsc,
  polygon_mainnet: polygon,
  base_mainnet: base,
};

export const SUPPORTED_CHAINS = [mainnet, sepolia, bsc, polygon, base] as const;

export function normalizeNetworkId(networkId: string): NetworkId {
  const lower = networkId.toLowerCase();
  if (lower in NETWORK_TO_CHAIN_ID) return lower as NetworkId;
  const legacy = LEGACY_NETWORK_ALIASES[lower];
  if (legacy) return legacy;
  return 'eth_sepolia';
}

export function chainIdOf(networkId: string): number {
  return NETWORK_TO_CHAIN_ID[normalizeNetworkId(networkId)];
}

export function networkIdOf(chainId: number): NetworkId {
  return CHAIN_ID_TO_NETWORK[chainId] ?? 'eth_sepolia';
}

export function chainOf(networkId: string): Chain {
  return CHAINS[normalizeNetworkId(networkId)] ?? sepolia;
}

export function nativeSymbolOf(networkId: string): string {
  return chainOf(networkId).nativeCurrency.symbol;
}

export function explorerOf(networkId: string, fromApi?: string | null): string {
  const id = normalizeNetworkId(networkId);
  return fromApi || FALLBACK_EXPLORER[id] || FALLBACK_EXPLORER.eth_sepolia;
}

export function rpcOf(networkId: string, fromApi?: string | null): string {
  if (fromApi && !fromApi.includes('PLACEHOLDER')) return fromApi;
  const id = normalizeNetworkId(networkId);
  return FALLBACK_RPC[id] ?? FALLBACK_RPC.eth_sepolia;
}

export function txUrl(networkId: string, hash: string, explorerUrl?: string | null): string {
  return `${explorerOf(networkId, explorerUrl)}/tx/${hash}`;
}

export function addressUrl(networkId: string, address: string, explorerUrl?: string | null): string {
  return `${explorerOf(networkId, explorerUrl)}/address/${address}`;
}

export function customChain(params: {
  id: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl?: string | null;
}): Chain {
  return defineChain({
    id: params.id,
    name: params.name,
    nativeCurrency: { name: params.symbol, symbol: params.symbol, decimals: 18 },
    rpcUrls: { default: { http: [params.rpcUrl] } },
    blockExplorers: params.explorerUrl
      ? { default: { name: 'Explorer', url: params.explorerUrl } }
      : undefined,
  });
}
