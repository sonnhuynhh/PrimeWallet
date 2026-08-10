import { getAddress, type Address } from 'viem';
import type { NetworkId } from '@/lib/wagmi/chains';

/**
 * Bảng spender đã biết.
 *
 * Quét log chỉ thấy những gì Etherscan trả về trong giới hạn trang; bảng này
 * đảm bảo các contract phổ biến (router Uniswap, Permit2…) luôn được kiểm tra
 * dù log scan có bỏ sót hay bị `truncated`.
 */

export interface KnownSpender {
  address: Address;
  name: string;
  /** Mô tả để người dùng biết mình đã cấp quyền cho cái gì. */
  description: string;
}

const PERMIT2: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

export const KNOWN_SPENDERS: Partial<Record<NetworkId, KnownSpender[]>> = {
  eth_sepolia: [
    {
      address: '0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E',
      name: 'Uniswap SwapRouter02',
      description: 'Router swap Uniswap V3 — PrimeWallet dùng cho tab Swap',
    },
    {
      address: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
      name: 'Uniswap Universal Router',
      description: 'Router hợp nhất của Uniswap',
    },
    { address: PERMIT2, name: 'Permit2', description: 'Chuẩn approve dùng chung của Uniswap' },
  ],
  eth_mainnet: [
    {
      address: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
      name: 'Uniswap SwapRouter02',
      description: 'Router swap Uniswap V3',
    },
    {
      address: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
      name: 'Uniswap Universal Router',
      description: 'Router hợp nhất của Uniswap',
    },
    { address: PERMIT2, name: 'Permit2', description: 'Chuẩn approve dùng chung của Uniswap' },
    {
      address: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
      name: 'LI.FI Diamond',
      description: 'Contract của aggregator LI.FI — PrimeWallet dùng để swap trên mainnet',
    },
  ],
  polygon_mainnet: [
    { address: PERMIT2, name: 'Permit2', description: 'Chuẩn approve dùng chung của Uniswap' },
  ],
  base_mainnet: [
    { address: PERMIT2, name: 'Permit2', description: 'Chuẩn approve dùng chung của Uniswap' },
  ],
  bsc_mainnet: [
    { address: PERMIT2, name: 'Permit2', description: 'Chuẩn approve dùng chung của Uniswap' },
  ],
};

export function knownSpenderOf(networkId: string, spender: Address): KnownSpender | null {
  const list = KNOWN_SPENDERS[networkId as NetworkId];
  if (!list) return null;
  const target = getAddress(spender);
  return list.find((item) => getAddress(item.address) === target) ?? null;
}

export function knownSpendersFor(networkId: string): KnownSpender[] {
  return KNOWN_SPENDERS[networkId as NetworkId] ?? [];
}
