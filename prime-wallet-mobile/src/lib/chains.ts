export type NetworkId =
  | "eth_sepolia"
  | "eth_mainnet"
  | "bsc_mainnet"
  | "polygon_mainnet"
  | "base_mainnet";

export const NETWORK_TO_CHAIN_ID: Record<NetworkId, number> = {
  eth_mainnet: 1,
  eth_sepolia: 11155111,
  bsc_mainnet: 56,
  polygon_mainnet: 137,
  base_mainnet: 8453,
};

export const CHAIN_ID_TO_NETWORK: Record<number, NetworkId> = {
  1: "eth_mainnet",
  11155111: "eth_sepolia",
  56: "bsc_mainnet",
  137: "polygon_mainnet",
  8453: "base_mainnet",
};

export const LEGACY_NETWORK_ALIASES: Record<string, NetworkId> = {
  ETH_SEPOLIA: "eth_sepolia",
  ETH_MAINNET: "eth_mainnet",
  BSC_MAINNET: "bsc_mainnet",
  POLYGON_MAINNET: "polygon_mainnet",
  BASE_MAINNET: "base_mainnet",
};

export const NETWORK_LABELS: Record<string, string> = {
  eth_sepolia: "Ethereum Sepolia",
  eth_mainnet: "Ethereum",
  bsc_mainnet: "BNB Chain",
  polygon_mainnet: "Polygon",
  base_mainnet: "Base",
};

export const FALLBACK_RPC: Record<string, string> = {
  eth_sepolia: "https://ethereum-sepolia-rpc.publicnode.com",
  eth_mainnet: "https://eth.llamarpc.com",
  bsc_mainnet: "https://bsc-dataseed.binance.org",
  polygon_mainnet: "https://polygon-rpc.com",
  base_mainnet: "https://mainnet.base.org",
};

export const EXPLORER_TX: Record<string, string> = {
  eth_sepolia: "https://sepolia.etherscan.io/tx/",
  eth_mainnet: "https://etherscan.io/tx/",
  bsc_mainnet: "https://bscscan.com/tx/",
  polygon_mainnet: "https://polygonscan.com/tx/",
  base_mainnet: "https://basescan.org/tx/",
};

export const EXPLORER_V2_API: Record<NetworkId, string> = {
  eth_mainnet: "https://api.etherscan.io/v2/api",
  eth_sepolia: "https://api.etherscan.io/v2/api",
  bsc_mainnet: "https://api.bscscan.com/v2/api",
  polygon_mainnet: "https://api.polygonscan.com/v2/api",
  base_mainnet: "https://api.basescan.org/v2/api",
};

export const SUPPORTS_LOG_SCAN: Record<NetworkId, boolean> = {
  eth_mainnet: true,
  eth_sepolia: true,
  bsc_mainnet: true,
  polygon_mainnet: true,
  base_mainnet: true,
};

export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

export function normalizeNetworkId(id: string): NetworkId {
  const lower = id.toLowerCase();
  if (lower in NETWORK_TO_CHAIN_ID) return lower as NetworkId;
  if (id in LEGACY_NETWORK_ALIASES) return LEGACY_NETWORK_ALIASES[id];
  return "eth_sepolia";
}

export function chainIdOf(networkId: string): number {
  const id = normalizeNetworkId(networkId);
  return NETWORK_TO_CHAIN_ID[id];
}

export function networkIdOf(chainId: number): NetworkId {
  return CHAIN_ID_TO_NETWORK[chainId] ?? "eth_sepolia";
}

export function explorerV2ApiOf(networkId: string): string {
  const id = normalizeNetworkId(networkId);
  return EXPLORER_V2_API[id];
}

export function networkLabel(id: string) {
  return NETWORK_LABELS[normalizeNetworkId(id)] ?? id;
}

export function rpcOf(networkId: string, override?: string) {
  if (override) return override;
  const id = normalizeNetworkId(networkId);
  return FALLBACK_RPC[id] ?? FALLBACK_RPC.eth_sepolia;
}

export function txExplorerUrl(networkId: string, hash: string) {
  const id = normalizeNetworkId(networkId);
  const base = EXPLORER_TX[id] ?? EXPLORER_TX.eth_sepolia;
  return `${base}${hash}`;
}
