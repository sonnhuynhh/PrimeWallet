/**
 * API base URL — đồng bộ với prime-wallet-web (VITE_API_BASE_URL).
 *
 * Ưu tiên EXPO_PUBLIC_API_BASE_URL trong .env.
 * Dev native: tự gợi ý theo platform nếu chưa cấu hình.
 */
import { Platform } from "react-native";
import Constants from "expo-constants";

const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const BACKEND_PORT = process.env.EXPO_PUBLIC_BACKEND_PORT ?? "8080";

function devDefaultForPlatform(): string {
  // Android Emulator: 10.0.2.2 = localhost của máy host
  // Chỉ dùng khi chắc chắn là emulator — thiết bị thật cần EXPO_PUBLIC_API_BASE_URL
  if (Platform.OS === "android" && !Constants.isDevice) {
    return `http://10.0.2.2:${BACKEND_PORT}`;
  }

  if (Platform.OS === "ios" && !Constants.isDevice) {
    return `http://localhost:${BACKEND_PORT}`;
  }

  if (Platform.OS === "web") {
    return `http://localhost:${BACKEND_PORT}`;
  }

  return `http://localhost:${BACKEND_PORT}`;
}

function resolveBaseUrl(): string {
  if (envUrl && envUrl.length > 0) {
    return envUrl.replace(/\/$/, "");
  }

  const fallback = devDefaultForPlatform();

  if (__DEV__ && Constants.isDevice) {
    console.warn(
      "[env] EXPO_PUBLIC_API_BASE_URL chưa đặt trên thiết bị thật.\n" +
        "  • Cùng WiFi: http://<IP-LAN>:8080  (npm run dev:api-url)\n" +
        "  • Khác mạng: npm run tunnel:backend"
    );
  }

  return fallback;
}

export const API_BASE_URL = resolveBaseUrl();

export const ALCHEMY_API_KEY = process.env.EXPO_PUBLIC_ALCHEMY_API_KEY?.trim() ?? "";
export const ETHERSCAN_API_KEY = process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY?.trim() ?? "";
export const WALLETCONNECT_PROJECT_ID = process.env.EXPO_PUBLIC_WC_PROJECT_ID?.trim() ?? "";

/** In ra console lúc dev để debug kết nối backend. */
export function logApiConfig() {
  if (__DEV__) {
    console.log(`[env] API_BASE_URL = ${API_BASE_URL}`);
  }
}
