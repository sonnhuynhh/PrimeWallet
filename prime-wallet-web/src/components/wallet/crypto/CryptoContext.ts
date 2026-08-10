import { createContext, useContext } from 'react';
import type { Address } from 'viem';
import type { ethers } from 'ethers';
import type { Config } from 'wagmi';
import type { CryptoWalletData } from './useCryptoWalletData';
import type { WalletUnlock } from './useWalletUnlock';
import type { TransactionCenterApi } from '@/lib/tx/transactionCenter';
import type { TokenBalance } from '@/types/crypto';

/**
 * Ngữ cảnh dùng chung cho 8 tab của ví crypto.
 *
 * Trước đây mọi state nằm trong CryptoShell nên mỗi tab mới lại phải kéo thêm
 * một tầng props. Gom vào context để tab tự lấy đúng thứ nó cần.
 */

export interface CryptoContextValue {
  data: CryptoWalletData;
  unlock: WalletUnlock;
  txCenter: TransactionCenterApi;
  /** chainId của mạng ví đang chọn (undefined nếu chưa có ví). */
  chainId: number | undefined;
  /** Địa chỉ ví đang chọn. */
  address: Address | undefined;
  /** Link explorer cho một tx hash. */
  explorerTxUrl: (hash: string) => string;
  /** Link explorer cho một địa chỉ. */
  explorerAddressUrl: (address: string) => string;
  /** Mở form gửi với token chỉ định (null = native coin). */
  openSend: (token: TokenBalance | null) => void;
  /** Ký + phát một giao dịch thô bằng ví in-app, trả tx hash. */
  signAndSend: (params: {
    to: Address;
    data?: `0x${string}`;
    value?: bigint;
    gasLimit?: bigint;
    summary: string;
  }) => Promise<`0x${string}` | null>;
  /** Signer ethers cho ví đang chọn (mở modal nhập seed nếu cần). */
  requireSigner: () => Promise<ethers.HDNodeWallet | null>;
  /** Mở modal liên kết/tạo ví. */
  openLink: (mode: 'link' | 'create') => void;
  /** true khi wagmi đã kết nối đúng địa chỉ ví đang chọn — ký qua extension, không cần seed. */
  usesWalletClient: boolean;
  /** Config wagmi để gửi tx khi usesWalletClient = true. */
  wagmiConfig: Config;
}

const CryptoContext = createContext<CryptoContextValue | null>(null);

export const CryptoContextProvider = CryptoContext.Provider;

export function useCrypto(): CryptoContextValue {
  const ctx = useContext(CryptoContext);
  if (!ctx) throw new Error('useCrypto phải nằm trong <CryptoShell>');
  return ctx;
}
