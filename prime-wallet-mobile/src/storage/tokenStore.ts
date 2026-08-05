import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_TOKEN_KEY = "primewallet.accessToken";
const REFRESH_TOKEN_KEY = "primewallet.refreshToken";

export async function getTokens() {
  const [accessToken, refreshToken] = await AsyncStorage.multiGet([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);

  return {
    accessToken: accessToken[1] ?? null,
    refreshToken: refreshToken[1] ?? null,
  };
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}
