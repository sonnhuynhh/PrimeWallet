import { swapRouter02Abi } from "./abis";
import {
  ADDRESS_THIS,
  DEADLINE_SECONDS,
  GAS_LIMIT_DEN,
  GAS_LIMIT_NUM,
  SEPOLIA_V3,
  SWAP_GAS_BUFFER,
} from "./constants";
import type { Address, SwapCall, SwapPlan, TxRequest } from "./types";
import { encodeFunctionData } from "./rpcClient";

export interface PermitSignature {
  token: Address;
  value: bigint;
  deadline: bigint;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
}

export interface BuildSwapParams {
  path: `0x${string}`;
  amountIn: bigint;
  amountOutMinimum: bigint;
  recipient: Address;
  fromNative: boolean;
  toNative: boolean;
  quoterGasEstimate: bigint;
  permit?: PermitSignature | null;
  nowSeconds?: number;
}

export function buildSwapPlan(params: BuildSwapParams): { plan: SwapPlan; tx: TxRequest } {
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const deadline = BigInt(now + DEADLINE_SECONDS);
  const calls: SwapCall[] = [];

  if (params.permit) {
    calls.push({
      label: "selfPermit",
      data: encodeFunctionData(swapRouter02Abi, "selfPermit", [
        params.permit.token,
        params.permit.value,
        params.permit.deadline,
        params.permit.v,
        params.permit.r,
        params.permit.s,
      ]),
    });
  }

  calls.push({
    label: "exactInput",
    data: encodeFunctionData(swapRouter02Abi, "exactInput", [
      {
        path: params.path,
        recipient: params.toNative ? ADDRESS_THIS : params.recipient,
        amountIn: params.amountIn,
        amountOutMinimum: params.amountOutMinimum,
      },
    ]),
  });

  if (params.toNative) {
    calls.push({
      label: "unwrapWETH9",
      data: encodeFunctionData(swapRouter02Abi, "unwrapWETH9", [params.amountOutMinimum, params.recipient]),
    });
  }

  const data = encodeFunctionData(swapRouter02Abi, "multicall", [deadline, calls.map((call) => call.data)]);

  const gasLimit = ((params.quoterGasEstimate + SWAP_GAS_BUFFER) * GAS_LIMIT_NUM) / GAS_LIMIT_DEN;

  return {
    plan: { deadline, calls, supportsSelfPermit: true },
    tx: {
      to: SEPOLIA_V3.swapRouter02,
      data,
      value: params.fromNative ? params.amountIn : 0n,
      gasLimit,
    },
  };
}

export { ADDRESS_THIS };
