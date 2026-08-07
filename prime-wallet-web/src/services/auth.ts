import { request } from "./http";
import type { AuthResponse, ChangePasswordRequest, LoginRequest, RefreshTokenRequest, RegisterRequest, UpdateProfileRequest, UserProfileResponse } from "../types/api";

export function login(payload: LoginRequest) {
  return request<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export function register(payload: RegisterRequest) {
  return request<AuthResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export function refreshToken(payload: RefreshTokenRequest) {
  return request<AuthResponse>("/api/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });
}

export function getProfile() {
  return request<UserProfileResponse>("/api/v1/auth/profile");
}

export function updateProfile(payload: UpdateProfileRequest) {
  return request<UserProfileResponse>("/api/v1/auth/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function changePassword(payload: ChangePasswordRequest) {
  return request<void>("/api/v1/auth/change-password", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
