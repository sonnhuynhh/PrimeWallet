import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "active_wallet_mode";

export async function loadWalletMode(): Promise<"fiat" | "crypto" | null> {
  const v = await AsyncStorage.getItem(KEY);
  if (v === "fiat" || v === "crypto") return v;
  return null;
}

export async function saveWalletMode(mode: "fiat" | "crypto" | null) {
  if (mode) await AsyncStorage.setItem(KEY, mode);
  else await AsyncStorage.removeItem(KEY);
}
