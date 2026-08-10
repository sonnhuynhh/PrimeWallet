import { request } from "./http";

export type AdminUserResponse = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  kycStatus: "PENDING" | "VERIFIED" | "REJECTED";
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  createdAt: string;
};

export type Page<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
};

export async function getAllUsers(page = 0, size = 20, q?: string) {
  const query = q ? `&q=${encodeURIComponent(q)}` : "";
  return request<Page<AdminUserResponse>>(`/api/v1/admin/users?page=${page}&size=${size}${query}`);
}

export async function getUserById(id: string) {
  return request<AdminUserResponse>(`/api/v1/admin/users/${id}`);
}

export async function updateKycStatus(id: string, kycStatus: "PENDING" | "VERIFIED" | "REJECTED", note?: string) {
  return request<AdminUserResponse>(`/api/v1/admin/users/${id}/kyc`, {
    method: "PUT",
    body: JSON.stringify({ kycStatus, note }),
  });
}

export async function lockUser(id: string) {
  return request<AdminUserResponse>(`/api/v1/admin/users/${id}/lock`, {
    method: "PUT",
  });
}

export async function unlockUser(id: string) {
  return request<AdminUserResponse>(`/api/v1/admin/users/${id}/unlock`, {
    method: "PUT",
  });
}

export async function runReconciliation(dateStr?: string) {
  const query = dateStr ? `?dateStr=${dateStr}` : "";
  return request<any>(`/api/v1/admin/reconcile${query}`, {
    method: "POST",
  });
}

export async function getAuditLogs(page = 0, size = 50, userId?: string, q?: string) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (userId) params.set("userId", userId);
  if (q) params.set("q", q);
  return request<Page<import('../types/api').AuditLogResponse>>(`/api/v1/admin/logs?${params.toString()}`);
}

export async function getAdminCryptoHistory(address: string, network = 'eth_sepolia') {
  const params = new URLSearchParams({ address, network });
  return request<import('./crypto').EtherscanResponse>(`/api/v1/admin/crypto/history?${params.toString()}`);
}

export type AdminStats = {
  totalUsers: number;
  totalAccounts: number;
  totalTransactions: number;
  totalTopUp: string;
  totalWithdraw: string;
  totalTransfer: string;
};

export async function getAdminTransactions(page = 0, size = 20, q?: string, type?: string, status?: string) {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (q) params.set("q", q);
  if (type) params.set("type", type);
  if (status) params.set("status", status);
  return request<Page<import('../types/api').TransactionResponse>>(
    `/api/v1/admin/transactions?${params.toString()}`
  );
}

export async function getAdminStats() {
  return request<AdminStats>(`/api/v1/admin/stats`);
}
