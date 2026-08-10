import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const PK_KEY = "crypto_private_key";

export async function savePrivateKey(privateKey: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(PK_KEY, privateKey);
    return;
  }
  await SecureStore.setItemAsync(PK_KEY, privateKey);
}

export async function getPrivateKey(): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(PK_KEY);
  }
  return SecureStore.getItemAsync(PK_KEY);
}

export async function clearPrivateKey() {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(PK_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(PK_KEY);
}
