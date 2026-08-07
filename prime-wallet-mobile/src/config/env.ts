/**
 * Fix #15: API base URL cấu hình theo môi trường thay vì hardcode IP LAN.
 *
 * Ưu tiên biến môi trường EXPO_PUBLIC_API_BASE_URL (đặt trong file .env hoặc
 * khi build EAS cho từng môi trường dev/staging/prod).
 *
 * Nếu KHÔNG đặt biến này:
 *   - Chạy web (localhost) → dùng http://localhost:8080
 *   - Chạy trên thiết bị/emulator → cần IP LAN của máy chạy backend,
 *     nên ta yêu cầu đặt EXPO_PUBLIC_API_BASE_URL và cảnh báo rõ ràng.
 *
 * Ví dụ file .env (đặt cùng cấp app.json):
 *   EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:8080
 */
import { Platform } from "react-native";

const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

function resolveBaseUrl(): string {
  if (envUrl && envUrl.length > 0) {
    return envUrl;
  }

  if (Platform.OS === "web") {
    return "http://localhost:8080";
  }

  // Native (iOS/Android) không thể dùng "localhost" để trỏ tới máy dev.
  // Cảnh báo dev đặt EXPO_PUBLIC_API_BASE_URL; fallback tạm về localhost.
  if (__DEV__) {
    console.warn(
      "[env] EXPO_PUBLIC_API_BASE_URL chưa được đặt. " +
        "Trên thiết bị thật/emulator hãy đặt IP LAN của máy chạy backend, " +
        "vd: EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:8080"
    );
  }

  return "http://localhost:8080";
}

export const API_BASE_URL = resolveBaseUrl();
