import { encodeFunctionData, type Address } from 'viem';
import { swapRouter02Abi } from './abis';
import {
  ADDRESS_THIS,
  DEADLINE_SECONDS,
  GAS_LIMIT_DEN,
  GAS_LIMIT_NUM,
  MSG_SENDER,
  SEPOLIA_V3,
  SWAP_GAS_BUFFER,
} from './constants';
import type { SwapCall, SwapPlan, TxRequest } from './types';

/**
 * Dựng calldata cho SwapRouter02.
 *
 *   multicall(deadline, [
 *     selfPermit(...)      ← chỉ khi đã ký permit ERC-2612
 *     exactInput(...)
 *     unwrapWETH9(...)     ← chỉ khi bán ra native
 *   ])
 *
 * Bán ra native: `recipient` của exactInput là ADDRESS_THIS để router giữ WETH,
 * rồi `unwrapWETH9` mở gói và trả ETH về ví người dùng.
 */

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
  /** true khi token đầu vào là native (ETH) — value của tx = amountIn. */
  fromNative: boolean;
  /** true khi token đầu ra là native — cần unwrapWETH9. */
  toNative: boolean;
  /** gas do Quoter ước tính cho route đã chọn. */
  quoterGasEstimate: bigint;
  permit?: PermitSignature | null;
  /** Cho phép truyền mốc thời gian để test tái lập được. */
  nowSeconds?: number;
}

export function buildSwapPlan(params: BuildSwapParams): { plan: SwapPlan; tx: TxRequest } {
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const deadline = BigInt(now + DEADLINE_SECONDS);

  const calls: SwapCall[] = [];

  if (params.permit) {
    calls.push({
      label: 'selfPermit',
      data: encodeFunctionData({
        abi: swapRouter02Abi,
        functionName: 'selfPermit',
        args: [
          params.permit.token,
          params.permit.value,
          params.permit.deadline,
          params.permit.v,
          params.permit.r,
          params.permit.s,
        ],
      }),
    });
  }

  calls.push({
    label: 'exactInput',
    data: encodeFunctionData({
      abi: swapRouter02Abi,
      functionName: 'exactInput',
      args: [
        {
          path: params.path,
          // Bán ra native → router giữ WETH lại để unwrap ở call sau.
          recipient: params.toNative ? ADDRESS_THIS : params.recipient,
          amountIn: params.amountIn,
          amountOutMinimum: params.amountOutMinimum,
        },
      ],
    }),
  });

  if (params.toNative) {
    calls.push({
      label: 'unwrapWETH9',
      data: encodeFunctionData({
        abi: swapRouter02Abi,
        functionName: 'unwrapWETH9',
        args: [params.amountOutMinimum, params.recipient],
      }),
    });
  }

  const data = encodeFunctionData({
    abi: swapRouter02Abi,
    functionName: 'multicall',
    args: [deadline, calls.map((call) => call.data)],
  });

  const gasLimit =
    ((params.quoterGasEstimate + SWAP_GAS_BUFFER) * GAS_LIMIT_NUM) / GAS_LIMIT_DEN;

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

/** Sentinel export lại cho UI hiển thị/giải thích recipient. */
export { ADDRESS_THIS, MSG_SENDER };
