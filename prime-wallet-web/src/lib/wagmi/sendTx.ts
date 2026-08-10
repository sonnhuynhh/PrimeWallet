import { getWalletClient } from 'wagmi/actions';
import type { Config } from 'wagmi';
import type { Address, Hex } from 'viem';

/** Gửi tx qua ví đang kết nối wagmi (MetaMask, OKX, ví in-app đã connect…). */
export async function sendWithWalletClient(
  config: Config,
  params: {
    to: Address;
    data?: Hex;
    value?: bigint;
    gas?: bigint;
  },
): Promise<Hex> {
  const client = await getWalletClient(config);
  if (!client?.account) {
    throw new Error('Chưa kết nối ví — hãy kết nối ví ngoài hoặc mở khoá ví in-app.');
  }
  return client.sendTransaction({
    account: client.account,
    chain: client.chain,
    to: params.to,
    data: params.data,
    value: params.value ?? 0n,
    gas: params.gas,
  });
}

/** Địa chỉ wagmi khớp ví đang chọn → có thể ký qua extension/connector thay vì nhập seed. */
export function canUseWalletClient(
  isConnected: boolean,
  wagmiAddress: Address | undefined,
  targetAddress: string | undefined,
): boolean {
  if (!isConnected || !wagmiAddress || !targetAddress) return false;
  return wagmiAddress.toLowerCase() === targetAddress.toLowerCase();
}
