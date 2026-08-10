import { ethers } from "ethers";

import { rpcOf } from "../chains";
import { isNativeAddress } from "./path";
import type { DexToken } from "./types";

const MAX_UINT = ethers.MaxUint256;

export async function needsSwapApproval(params: {
  networkId: string;
  owner: string;
  tokenIn: DexToken;
  spender: string;
  amountIn: bigint;
}): Promise<boolean> {
  if (isNativeAddress(params.tokenIn.address)) return false;

  const provider = new ethers.JsonRpcProvider(rpcOf(params.networkId));
  const contract = new ethers.Contract(
    params.tokenIn.address,
    ["function allowance(address owner, address spender) view returns (uint256)"],
    provider,
  );
  const allowance = (await contract.allowance(params.owner, params.spender)) as bigint;
  return allowance < params.amountIn;
}

export function buildApproveCalldata(spender: string, amount: bigint = MAX_UINT): `0x${string}` {
  const iface = new ethers.Interface(["function approve(address spender, uint256 amount)"]);
  return iface.encodeFunctionData("approve", [spender, amount]) as `0x${string}`;
}

export function buildRevokeCalldata(spender: string): `0x${string}` {
  return buildApproveCalldata(spender, 0n);
}
