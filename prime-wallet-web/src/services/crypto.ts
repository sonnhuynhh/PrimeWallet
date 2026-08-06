import { request } from "./http";

export type CryptoWallet = {
  id: string;
  walletAddress: string;
  blockchainNetwork: string;
  linkedAt: string;
};

export type WalletBalance = {
  walletId: string;
  walletAddress: string;
  blockchainNetwork: string;
  balanceEth: number;
  balanceWei: string;
};

export async function linkCryptoWallet(walletAddress: string, blockchainNetwork: string = "ETH_SEPOLIA") {
  return request<CryptoWallet>("/api/v1/crypto/wallets/link", {
    method: "POST",
    body: JSON.stringify({ walletAddress, blockchainNetwork }),
  });
}

export async function getLinkedWallets() {
  return request<CryptoWallet[]>("/api/v1/crypto/wallets");
}

export async function getWalletBalance(walletId: string) {
  return request<WalletBalance>(`/api/v1/crypto/wallets/${walletId}/balance`);
}

export async function broadcastTransaction(signedTransactionHex: string) {
  return request<{ transactionHash: string }>("/api/v1/crypto/transactions/broadcast", {
    method: "POST",
    body: JSON.stringify({ signedTransactionHex }),
  });
}

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

export async function getWalletHistory(walletId: string) {
  return request<EtherscanResponse>(`/api/v1/crypto/wallets/${walletId}/history`);
}
