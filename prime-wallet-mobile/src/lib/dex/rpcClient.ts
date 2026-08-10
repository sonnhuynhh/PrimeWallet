import { ethers, Interface, AbiCoder } from "ethers";

import type { Address } from "./types";

export type DexRpcClient = {
  readContract<T>(args: {
    address: Address;
    abi: readonly unknown[];
    functionName: string;
    args?: readonly unknown[];
  }): Promise<T>;
  getGasPrice(): Promise<bigint>;
};

export function createDexRpcClient(provider: ethers.JsonRpcProvider): DexRpcClient {
  return {
    async readContract<T>(args: {
      address: Address;
      abi: readonly unknown[];
      functionName: string;
      args?: readonly unknown[];
    }): Promise<T> {
      const iface = new Interface(args.abi as ethers.InterfaceAbi);
      const data = iface.encodeFunctionData(args.functionName, args.args ?? []);
      const raw = await provider.call({ to: args.address, data });
      const decoded = iface.decodeFunctionResult(args.functionName, raw);
      return decoded as T;
    },
    async getGasPrice() {
      const fee = await provider.getFeeData();
      return fee.gasPrice ?? 0n;
    },
  };
}

export function encodeFunctionData(
  abi: readonly unknown[],
  functionName: string,
  args: readonly unknown[],
): `0x${string}` {
  const iface = new Interface(abi as ethers.InterfaceAbi);
  return iface.encodeFunctionData(functionName, args) as `0x${string}`;
}

export function decodeFunctionResult<T>(
  abi: readonly unknown[],
  functionName: string,
  data: `0x${string}`,
): T {
  const iface = new Interface(abi as ethers.InterfaceAbi);
  return iface.decodeFunctionResult(functionName, data) as T;
}

export function getAddress(addr: string): Address {
  return ethers.getAddress(addr) as Address;
}

export function concatHex(parts: readonly `0x${string}`[]): `0x${string}` {
  return ethers.concat(parts) as `0x${string}`;
}

export function feeToHex3(fee: number): `0x${string}` {
  const buf = new Uint8Array(3);
  buf[0] = (fee >> 16) & 0xff;
  buf[1] = (fee >> 8) & 0xff;
  buf[2] = fee & 0xff;
  return ethers.hexlify(buf) as `0x${string}`;
}

export function keccak256(data: `0x${string}`): `0x${string}` {
  return ethers.keccak256(data) as `0x${string}`;
}

export function encodePoolSalt(token0: Address, token1: Address, fee: number): `0x${string}` {
  return AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24"],
    [token0, token1, fee],
  ) as `0x${string}`;
}
