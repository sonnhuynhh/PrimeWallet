import { ethers } from "ethers";

import type { NetworkId } from "../chains";

export interface KnownSpender {
  address: string;
  name: string;
  description: string;
}

const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

export const KNOWN_SPENDERS: Partial<Record<NetworkId, KnownSpender[]>> = {
  eth_sepolia: [
    {
      address: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E",
      name: "Uniswap SwapRouter02",
      description: "Router swap Uniswap V3",
    },
    { address: PERMIT2, name: "Permit2", description: "Chuẩn approve Uniswap" },
  ],
  eth_mainnet: [
    {
      address: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
      name: "Uniswap SwapRouter02",
      description: "Router swap Uniswap V3",
    },
    { address: PERMIT2, name: "Permit2", description: "Chuẩn approve Uniswap" },
    {
      address: "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE",
      name: "LI.FI Diamond",
      description: "Aggregator LI.FI",
    },
  ],
  polygon_mainnet: [{ address: PERMIT2, name: "Permit2", description: "Chuẩn approve Uniswap" }],
  base_mainnet: [{ address: PERMIT2, name: "Permit2", description: "Chuẩn approve Uniswap" }],
  bsc_mainnet: [{ address: PERMIT2, name: "Permit2", description: "Chuẩn approve Uniswap" }],
};

export function knownSpenderOf(networkId: string, spender: string): KnownSpender | null {
  const list = KNOWN_SPENDERS[networkId as NetworkId];
  if (!list) return null;
  const target = ethers.getAddress(spender);
  return list.find((item) => ethers.getAddress(item.address) === target) ?? null;
}

export function knownSpendersFor(networkId: string): KnownSpender[] {
  return KNOWN_SPENDERS[networkId as NetworkId] ?? [];
}
