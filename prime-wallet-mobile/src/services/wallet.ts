import { request } from "./http";
import type { AccountResponse, TopUpRequest, TransactionResponse, TransferRequest, WithdrawRequest } from "../types/api";

export function createAccount() {
  return request<AccountResponse>("/api/v1/accounts", {
    method: "POST",
  });
}

export function getMyAccount() {
  return request<AccountResponse>("/api/v1/accounts/me");
}

export function getMyAccounts() {
  return request<AccountResponse[]>("/api/v1/accounts");
}

export function topUp(payload: TopUpRequest) {
  return request<TransactionResponse>("/api/v1/transactions/top-up", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function withdraw(payload: WithdrawRequest) {
  return request<TransactionResponse>("/api/v1/transactions/withdraw", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function transfer(payload: TransferRequest) {
  return request<TransactionResponse>("/api/v1/transactions/transfer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getTransactionHistory(accountId: string, page = 0, size = 20) {
  return request<{ content: TransactionResponse[]; totalElements: number; totalPages: number }>(
    `/api/v1/transactions/history/${accountId}?page=${page}&size=${size}`
  );
}
