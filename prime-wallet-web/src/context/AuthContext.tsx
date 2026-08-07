import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { changePassword, getProfile, login, register, updateProfile as updateProfileRequest } from "../services/auth";
import { getMyAccount } from "../services/wallet";
import { clearTokens, getTokens, saveTokens } from "../storage/tokenStore";
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
  setActiveWalletMode: (mode: "fiat" | "crypto" | null) => void;
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
      const profile = await getProfile();
      const account = await getMyAccount();

      setSession({
        auth: {
          accessToken,
          refreshToken,
          email: profile.email,
          fullName: profile.fullName,
          role: profile.role,
        },
        profile,
        account,
      });
    } catch {
      await clearTokens();
      setSession(null);
    }
  };

  useEffect(() => {
    (async () => {
      await reloadSession();
      setLoading(false);
    })();
  }, []);

  const signIn = async (payload: LoginRequest) => {
    const auth = await login(payload);
    await saveTokens(auth.accessToken, auth.refreshToken);
    const nextSession = await buildSession(auth);
    setSession(nextSession);
  };

  const signUp = async (payload: RegisterRequest) => {
    const auth = await register(payload);
    await saveTokens(auth.accessToken, auth.refreshToken);
    const nextSession = await buildSession(auth);
    setSession(nextSession);
  };

  const signOut = async () => {
    await clearTokens();
    setSession(null);
    setActiveWalletMode(null);
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
      setActiveWalletMode,
    }),
    [loading, session, activeWalletMode]
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
