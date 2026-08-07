import type { ApiResponse } from "./api";

/* ==================== NETWORKS ==================== */

export interface NetworkInfo {
  id: string; // eth_sepolia
  label: string; // "Ethereum Sepolia"
  nativeSymbol: string; // ETH
  chainId: number;
  testnet: boolean;
  explorerUrl?: string;
  /** RPC URL do server quản lý — client ký offline bằng URL này (không dùng RPC cứng). */
  rpcUrl?: string;
}

/* ==================== WALLETS ==================== */

export interface CryptoWalletInfo {
  id: string;
  walletAddress: string;
  blockchainNetwork: string;
  label?: string;
  primary: boolean;
  linkedAt: string;
}

export interface TokenBalance {
  contractAddress?: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string; // đã chia decimals (dạng chuỗi để tránh mất precision)
  rawBalance?: string;
  logoUrl?: string;
  isNative?: boolean;
}

export interface WalletBalanceData {
  walletId: string;
  walletAddress: string;
  blockchainNetwork: string;
  networkLabel: string;
  balanceEth: string;
  balanceWei: string;
  nativeSymbol: string;
  chainId: number;
  tokens?: TokenBalance[];
}

/* ==================== GAS & SEND ==================== */

export interface EstimateGasData {
  gasLimit: string;
  gasPriceWei: string;
  totalFeeWei: string;
  totalFeeEth: string;
  nativeSymbol: string;
}

export interface GasPriceData {
  blockchainNetwork: string;
  gasPriceWei: string;
  nativeSymbol: string;
}

export interface TransactionHashData {
  transactionHash: string;
}

/* ==================== HISTORY ==================== */

export interface EtherscanTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
}

export interface EtherscanResponse {
  status: string;
  message: string;
  result: EtherscanTransaction[];
}

export interface InAppTransaction {
  id: string;
  type: string;
  txHash?: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  symbol: string;
  tokenAddress?: string;
  gasPriceWei?: string;
  gasLimit?: string;
  feeWei?: string;
  status: string;
  description?: string;
  createdAt: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

/* ==================== OWNERSHIP ==================== */

export interface OwnershipChallengeData {
  address: string;
  nonce: string;
  message: string;
  expiresInSeconds: number;
}

export interface OwnershipVerification {
  verified: boolean;
}

export interface ApiWire {
  payload: ApiResponse<unknown>;
}

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  contract: string;
}