export type Role = "USER" | "ADMIN";
export type KycStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type AccountStatus = "ACTIVE" | "LOCKED";
export type TransactionStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
export type TransactionType = "TOPUP" | "WITHDRAW" | "TRANSFER";

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  fullName: string;
  email: string;
  role: Role;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  phone: string;
  password: string;
  fullName: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface UpdateProfileRequest {
  fullName: string;
  dateOfBirth?: string | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface UserProfileResponse {
  email: string;
  phone: string;
  fullName: string;
  dateOfBirth?: string | null;
  kycStatus: KycStatus;
  status: AccountStatus;
  createdAt: string;
}

export interface AccountResponse {
  id: string;
  accountNumber: string;
  currency: string;
  balance: string;
  status: string;
  accountType: string;
  createdAt: string;
}

export interface TopUpRequest {
  idempotencyKey: string;
  amount: string;
  description?: string;
}

export interface WithdrawRequest {
  idempotencyKey: string;
  amount: string;
  description?: string;
}

export interface TransferRequest {
  idempotencyKey: string;
  destinationAccountNumber: string;
  amount: string;
  description?: string;
}

export interface TransactionResponse {
  id: string;
  referenceNumber: string;
  transactionType: TransactionType;
  sourceAccountNumber?: string | null;
  destinationAccountNumber?: string | null;
  amount: string;
  fee: string;
  currency: string;
  description?: string | null;
  status: TransactionStatus;
  createdAt: string;
}

export interface SessionState {
  auth: AuthResponse;
  profile: UserProfileResponse;
  account: AccountResponse | null;
}
