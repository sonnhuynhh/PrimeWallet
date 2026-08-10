import { Alert } from "react-native";

export function toastOk(title: string, message?: string) {
  Alert.alert(title, message);
}

export function toastErr(error: unknown, fallback = "Đã xảy ra lỗi") {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
  Alert.alert("Lỗi", message);
}
