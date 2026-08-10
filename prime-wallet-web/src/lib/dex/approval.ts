import { encodeFunctionData, maxUint256, type Address } from 'viem';
import { getPublicClient } from '@/lib/wagmi/clients';
import { networkIdOf } from '@/lib/wagmi/chains';
import { erc20Abi } from './abis';
import type { DexToken } from './constants';
import { isNativeAddress } from './path';

/** ERC-20 cần approve cho router trước khi swap? */
export async function needsSwapApproval(params: {
  chainId: number;
  owner: Address;
  tokenIn: DexToken;
  spender: Address;
  amountIn: bigint;
}): Promise<boolean> {
  if (isNativeAddress(params.tokenIn.address)) return false;

  const client = getPublicClient(networkIdOf(params.chainId));
  const allowance = await client.readContract({
    address: params.tokenIn.address as Address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [params.owner, params.spender],
  });

  return allowance < params.amountIn;
}

export function buildApproveCalldata(spender: Address, amount: bigint = maxUint256): `0x${string}` {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, amount],
  });
}
