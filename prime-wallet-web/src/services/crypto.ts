import { request } from "./http";
import type {
  NetworkInfo,
  CryptoWalletInfo,
  WalletBalanceData,
  TokenBalance,
  EstimateGasData,
  GasPriceData,
  TransactionHashData,
  EtherscanResponse,
  InAppTransaction,
  PageResponse,
  OwnershipChallengeData,
  OwnershipVerification,
  TokenInfo,
} from "../types/crypto";

/* ==================== NETWORKS ==================== */

export async function getSupportedNetworks(): Promise<NetworkInfo[]> {
  return request<NetworkInfo[]>("/api/v1/crypto/wallets/networks");
}

/* ==================== WALLETS ==================== */

export async function linkCryptoWallet(payload: {
  walletAddress: string;
  blockchainNetwork: string;
  label?: string;
}): Promise<CryptoWalletInfo> {
  return request<CryptoWalletInfo>("/api/v1/crypto/wallets/link", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getLinkedWallets(): Promise<CryptoWalletInfo[]> {
  return request<CryptoWalletInfo[]>("/api/v1/crypto/wallets");
}

export async function getWalletBalance(walletId: string): Promise<WalletBalanceData> {
  return request<WalletBalanceData>(`/api/v1/crypto/wallets/${walletId}/balance`);
}

export async function getWalletSupportedTokens(walletId: string): Promise<TokenInfo[]> {
  return request<TokenInfo[]>(`/api/v1/crypto/wallets/${walletId}/tokens`);
}

export async function unlinkCryptoWallet(walletId: string): Promise<void> {
  return request<void>(`/api/v1/crypto/wallets/${walletId}`, { method: "DELETE" });
}

/* ==================== GAS / BROADCAST / SEND ==================== */

export interface EstimateGasRequest {
  blockchainNetwork: string;
  fromAddress: string;
  toAddress: string;
  amount: string; // native: ETH; token: số lượng token (VD "100")
  tokenAddress?: string; // bỏ trống = native coin
}

export async function estimateGas(payload: EstimateGasRequest): Promise<EstimateGasData> {
  return request<EstimateGasData>("/api/v1/crypto/transactions/estimate-gas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getGasPrice(network: string = "eth_sepolia"): Promise<GasPriceData> {
  return request<GasPriceData>(
    `/api/v1/crypto/transactions/gas-price?network=${encodeURIComponent(network)}`
  );
}

export async function broadcastTransaction(
  signedTransactionHex: string,
  blockchainNetwork: string = "eth_sepolia"
): Promise<TransactionHashData> {
  return request<TransactionHashData>(
    `/api/v1/crypto/transactions/broadcast?blockchainNetwork=${encodeURIComponent(blockchainNetwork)}`,
    {
      method: "POST",
      body: JSON.stringify({ signedTransactionHex }),
    }
  );
}

export interface SendTransactionData {
  transactionHash: string;
  transactionId: string;
  status: string;
}

/**
 * Gửi token: broadcast signed tx + lưu lịch sử in-app + phát Kafka event cho AI.
 */
export async function sendTransaction(payload: {
  blockchainNetwork: string;
  signedTransactionHex: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  symbol: string;
  tokenAddress?: string;
}): Promise<SendTransactionData> {
  return request<SendTransactionData>("/api/v1/crypto/transactions/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ==================== HISTORY ==================== */

export async function getWalletHistory(walletId: string): Promise<EtherscanResponse> {
  return request<EtherscanResponse>(`/api/v1/crypto/wallets/${walletId}/history`);
}

export async function getInAppTransactions(
  walletId: string,
  page = 0,
  size = 20
): Promise<PageResponse<InAppTransaction>> {
  return request<PageResponse<InAppTransaction>>(
    `/api/v1/crypto/wallets/${walletId}/transactions?page=${page}&size=${size}`
  );
}

/* ==================== OWNERSHIP ==================== */

export async function createOwnershipChallenge(address: string): Promise<OwnershipChallengeData> {
  return request<OwnershipChallengeData>(
    `/api/v1/crypto/wallets/ownership/challenge?address=${encodeURIComponent(address)}`
  );
}

export async function verifyOwnership(payload: {
  address: string;
  signature: string;
  message: string;
}): Promise<OwnershipVerification> {
  return request<OwnershipVerification>("/api/v1/crypto/wallets/ownership/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* Re-export cho tương thích code cũ */
export type { WalletBalanceData as WalletBalance } from "../types/crypto";
export type { EtherscanTransaction, EtherscanResponse } from "../types/crypto";
export type { CryptoWalletInfo as CryptoWallet } from "../types/crypto";
export type { TokenBalance };