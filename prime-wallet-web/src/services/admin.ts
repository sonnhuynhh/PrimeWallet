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

export type FraudRiskLevel = "SAFE" | "MEDIUM" | "HIGH";

export type FraudReportUser = {
  user_id: string;
  email?: string | null;
  fullName?: string | null;
  phone?: string | null;
  status?: string | null;
  kycStatus?: string | null;
  role?: string | null;
  transaction_count: number;
  score: number;
  level: FraudRiskLevel;
  label?: string;
  factors?: string[];
  anomalies?: number;
  model_trained?: boolean;
};

export type FraudReport = {
  available?: boolean;
  error?: string;
  message?: string;
  model_trained?: boolean;
  total_users_scanned?: number;
  summary?: {
    high: number;
    medium: number;
    safe: number;
    total: number;
  };
  users?: FraudReportUser[];
};

export async function getAdminFraudReport(minLevel: FraudRiskLevel = "SAFE", limit = 100) {
  const params = new URLSearchParams({
    minLevel,
    limit: String(limit),
  });
  return request<FraudReport>(`/api/v1/admin/fraud-report?${params.toString()}`);
}

export async function getAdminUserRiskScore(userId: string) {
  return request<import("./ai").AiRiskScoreData>(`/api/v1/admin/users/${userId}/risk-score`);
}

export type AdminUserDetail = {
  user: AdminUserResponse;
  accounts: import("../types/api").AccountResponse[];
  recentTransactions: import("../types/api").TransactionResponse[];
  riskScore?: import("./ai").AiRiskScoreData | null;
};

export async function getAdminUserDetail(userId: string) {
  return request<AdminUserDetail>(`/api/v1/admin/users/${userId}/detail`);
}

export async function getAdminUserAccounts(userId: string) {
  return request<import("../types/api").AccountResponse[]>(`/api/v1/admin/users/${userId}/accounts`);
}
