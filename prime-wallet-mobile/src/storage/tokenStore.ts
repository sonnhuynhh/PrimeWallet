import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { Role } from "../types/api";

/**
 * Fix #12: Lưu token bằng expo-secure-store (mã hoá bởi Keychain/Keystore của OS)
 * thay vì AsyncStorage (lưu plaintext — đọc được trên thiết bị đã root/jailbreak).
 *
 * SecureStore KHÔNG hỗ trợ web, nên ta fallback về AsyncStorage khi chạy web.
 * (Trên web, token nằm trong localStorage — chấp nhận được cho môi trường dev.)
 */
const ACCESS_TOKEN_KEY = "primewallet.accessToken";
const REFRESH_TOKEN_KEY = "primewallet.refreshToken";
const ROLE_KEY = "primewallet.role";

const isWeb = Platform.OS === "web";

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function getTokens() {
  const [accessToken, refreshToken] = await Promise.all([
    getItem(ACCESS_TOKEN_KEY),
    getItem(REFRESH_TOKEN_KEY),
  ]);

  return {
    accessToken: accessToken ?? null,
    refreshToken: refreshToken ?? null,
  };
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await Promise.all([
    setItem(ACCESS_TOKEN_KEY, accessToken),
    setItem(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

/**
 * Fix #14: Lưu role của user (USER/ADMIN) để khôi phục session đúng quyền
 * sau khi mở lại app — trước đây role bị hardcode "USER".
 */
export async function saveRole(role: Role) {
  await setItem(ROLE_KEY, role);
}

export async function getRole(): Promise<Role> {
  const role = await getItem(ROLE_KEY);
  return role === "ADMIN" ? "ADMIN" : "USER";
}

export async function clearTokens() {
  await Promise.all([
    removeItem(ACCESS_TOKEN_KEY),
    removeItem(REFRESH_TOKEN_KEY),
    removeItem(ROLE_KEY),
  ]);
}
