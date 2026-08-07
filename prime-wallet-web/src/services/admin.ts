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

export async function getAllUsers(page = 0, size = 20) {
  return request<Page<AdminUserResponse>>(`/api/v1/admin/users?page=${page}&size=${size}`);
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

export async function getAuditLogs(page = 0, size = 50, userId?: string) {
  const query = userId ? `?userId=${userId}&page=${page}&size=${size}` : `?page=${page}&size=${size}`;
  return request<Page<import('../types/api').AuditLogResponse>>(`/api/v1/admin/logs${query}`);
}

export async function getAdminCryptoHistory(address: string) {
  return request<import('./crypto').EtherscanResponse>(`/api/v1/admin/crypto/history?address=${address}`);
}
