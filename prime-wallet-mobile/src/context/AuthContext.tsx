import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { changePassword, getProfile, login, register, updateProfile as updateProfileRequest } from "../services/auth";
import { setOnAuthFailure } from "../services/http";
import { getMyAccount } from "../services/wallet";
import { clearTokens, getRole, getTokens, saveRole, saveTokens } from "../storage/tokenStore";
import { loadWalletMode, saveWalletMode } from "../storage/walletModeStore";
import type { AuthResponse, ChangePasswordRequest, LoginRequest, RegisterRequest, SessionState, UpdateProfileRequest } from "../types/api";

type AuthContextValue = {
  loading: boolean;
  session: SessionState | null;
  signIn: (payload: LoginRequest) => Promise<void>;
  signUp: (payload: RegisterRequest) => Promise<void>;
  signOut: () => Promise<void>;
  reloadSession: () => Promise<void>;
  updateProfile: (payload: UpdateProfileRequest) => Promise<void>;
  changePassword: (payload: ChangePasswordRequest) => Promise<void>;
  activeWalletMode: "fiat" | "crypto" | null;
  setActiveWalletMode: (mode: "fiat" | "crypto" | null) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function buildSession(auth: AuthResponse): Promise<SessionState> {
  const [profile, account] = await Promise.all([getProfile(), getMyAccount()]);
  return { auth, profile, account };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SessionState | null>(null);
  const [activeWalletMode, setActiveWalletMode] = useState<"fiat" | "crypto" | null>(null);

  const reloadSession = async () => {
    const { accessToken, refreshToken } = await getTokens();

    if (!accessToken || !refreshToken) {
      setSession(null);
      return;
    }

    try {
      const [profile, account, role] = await Promise.all([getProfile(), getMyAccount(), getRole()]);

      setSession({
        auth: {
          accessToken,
          refreshToken,
          email: profile.email,
          fullName: profile.fullName,
          // Fix #14: role lấy từ storage (đã lưu lúc đăng nhập) thay vì hardcode "USER".
          role,
        },
        profile,
        account,
      });
    } catch {
      await clearTokens();
      setSession(null);
    }
  };

  // Fix #7: Khi refresh token hết hạn, http layer gọi callback này để đăng xuất.
  useEffect(() => {
    setOnAuthFailure(() => setSession(null));
    return () => setOnAuthFailure(null);
  }, []);

  useEffect(() => {
    (async () => {
      const savedMode = await loadWalletMode();
      if (savedMode) setActiveWalletMode(savedMode);
      await reloadSession();
      setLoading(false);
    })();
  }, []);

  const setActiveWalletModePersist = useCallback(async (mode: "fiat" | "crypto" | null) => {
    setActiveWalletMode(mode);
    await saveWalletMode(mode);
  }, []);

  const signIn = async (payload: LoginRequest) => {
    const auth = await login(payload);
    await saveTokens(auth.accessToken, auth.refreshToken);
    // Fix #14: lưu role trả về từ backend để khôi phục đúng quyền khi mở lại app.
    await saveRole(auth.role);
    const nextSession = await buildSession(auth);
    setSession(nextSession);
  };

  const signUp = async (payload: RegisterRequest) => {
    const auth = await register(payload);
    await saveTokens(auth.accessToken, auth.refreshToken);
    await saveRole(auth.role);
    const nextSession = await buildSession(auth);
    setSession(nextSession);
  };

  const signOut = async () => {
    await clearTokens();
    setSession(null);
    setActiveWalletMode(null);
    await saveWalletMode(null);
  };

  const updateProfile = async (payload: UpdateProfileRequest) => {
    const profile = await updateProfileRequest(payload);
    setSession((current) => (current ? { ...current, profile } : current));
  };

  const updatePassword = async (payload: ChangePasswordRequest) => {
    await changePassword(payload);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      signIn,
      signUp,
      signOut,
      reloadSession,
      updateProfile,
      changePassword: updatePassword,
      activeWalletMode,
      setActiveWalletMode: setActiveWalletModePersist,
    }),
    [loading, session, activeWalletMode, setActiveWalletModePersist]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
