import { request } from "./http";

export interface BridgeQuote {
  orderId: string;
  blockchainNetwork: string;
  fromAddress: string;
  tokenSymbol: string;
  tokenAddress: string | null;
  tokenAmount: string;
  tokenAmountRaw: string;
  vndAmount: number;
  rateVnd: number;
  treasuryAddress: string;
  expiresAt: string;
  rateSource?: string;
  rateUpdatedAt?: string;
}

export interface BridgeRates {
  rates: Record<string, number>;
  source: string;
  updatedAt: string | null;
}

export interface BridgeOrder {
  id: string;
  status: string;
  blockchainNetwork: string;
  fromAddress: string;
  tokenSymbol: string;
  tokenAddress: string | null;
  tokenAmount: string;
  vndAmount: number;
  rateVnd: number;
  treasuryAddress: string;
  depositTxHash: string | null;
  fiatTransactionId: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface BridgeQuotePayload {
  cryptoWalletId: string;
  tokenSymbol: string;
  tokenAddress?: string;
  tokenDecimals?: number;
  amount: string;
}

export function getBridgeRates(network: string) {
  return request<BridgeRates>(`/api/v1/bridge/rates?network=${encodeURIComponent(network)}`);
}

export function createBridgeQuote(payload: BridgeQuotePayload) {
  return request<BridgeQuote>("/api/v1/bridge/quote", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function confirmBridgeOrder(orderId: string, txHash: string) {
  return request<BridgeOrder>(`/api/v1/bridge/orders/${orderId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ txHash }),
  });
}

export function listBridgeOrders(page = 0, size = 10) {
  return request<{ content: BridgeOrder[]; totalElements: number }>(
    `/api/v1/bridge/orders?page=${page}&size=${size}`,
  );
}
