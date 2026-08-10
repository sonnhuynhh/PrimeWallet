import { request } from "./http";

export type CryptoWallet = {
  id: string;
  walletAddress: string;
  blockchainNetwork: string;
  label?: string;
  linkedAt: string;
};

export type NetworkInfo = {
  id: string;
  name: string;
  label?: string;
  nativeSymbol: string;
  chainId?: number;
  rpcUrl?: string;
  explorerUrl?: string;
};

export type WalletBalance = {
  walletId: string;
  walletAddress: string;
  blockchainNetwork: string;
  balanceEth: string | number;
  balanceWei: string;
  nativeSymbol?: string;
};

export type TokenInfo = {
  symbol: string;
  name: string;
  contractAddress?: string;
  decimals: number;
};

export type EtherscanTransaction = {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
};

export type EtherscanResponse = {
  status: string;
  message: string;
  result: EtherscanTransaction[];
};

export function getSupportedNetworks() {
  return request<NetworkInfo[]>("/api/v1/crypto/wallets/networks");
}

export function linkCryptoWallet(payload: {
  walletAddress: string;
  blockchainNetwork: string;
  label?: string;
}) {
  return request<CryptoWallet>("/api/v1/crypto/wallets/link", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function linkCryptoWalletWithProof(payload: {
  walletAddress: string;
  blockchainNetwork: string;
  label?: string;
  message: string;
  signature: string;
}) {
  return request<CryptoWallet>("/api/v1/crypto/wallets/link-with-proof", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getLinkedWallets() {
  return request<CryptoWallet[]>("/api/v1/crypto/wallets");
}

export function getWalletBalance(walletId: string) {
  return request<WalletBalance>(`/api/v1/crypto/wallets/${walletId}/balance`);
}

export function getWalletSupportedTokens(walletId: string) {
  return request<TokenInfo[]>(`/api/v1/crypto/wallets/${walletId}/tokens`);
}

export function unlinkCryptoWallet(walletId: string) {
  return request<void>(`/api/v1/crypto/wallets/${walletId}`, { method: "DELETE" });
}

export function broadcastTransaction(signedTransactionHex: string, blockchainNetwork = "eth_sepolia") {
  return request<{ transactionHash: string }>(
    `/api/v1/crypto/transactions/broadcast?blockchainNetwork=${encodeURIComponent(blockchainNetwork)}`,
    { method: "POST", body: JSON.stringify({ signedTransactionHex }) },
  );
}

export function getWalletHistory(walletId: string) {
  return request<EtherscanResponse>(`/api/v1/crypto/wallets/${walletId}/history`);
}

export function createOwnershipChallenge(address: string) {
  return request<{ message: string; expiresAt: string }>(
    `/api/v1/crypto/wallets/ownership/challenge?address=${encodeURIComponent(address)}`,
  );
}

export function estimateGas(payload: {
  blockchainNetwork: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenAddress?: string;
  tokenDecimals?: number;
}) {
  return request<import("../types/crypto").EstimateGasData>("/api/v1/crypto/transactions/estimate-gas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function sendTransaction(payload: {
  blockchainNetwork: string;
  signedTransactionHex: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  symbol: string;
  tokenAddress?: string;
}) {
  return request<{ transactionHash: string }>("/api/v1/crypto/transactions/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getInAppTransactions(walletId: string, page = 0, size = 20) {
  return request<{ content: import("../types/crypto").InAppTransaction[] }>(
    `/api/v1/crypto/wallets/${walletId}/transactions?page=${page}&size=${size}`,
  );
}

export function recordTransaction(payload: {
  blockchainNetwork: string;
  transactionHash: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  symbol: string;
  tokenAddress?: string;
  type?: string;
  description?: string;
}) {
  return request<{ transactionHash: string }>("/api/v1/crypto/transactions/record", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
