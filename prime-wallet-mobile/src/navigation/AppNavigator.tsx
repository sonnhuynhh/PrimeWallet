import { NavigationContainer, DarkTheme, type LinkingOptions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import { SplashScreen } from "../screens/SplashScreen";
import { LandingScreen } from "../screens/LandingScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { WalletTypeScreen } from "../screens/WalletTypeScreen";
import { FiatShellScreen } from "../screens/FiatShellScreen";
import { CryptoShellScreen } from "../screens/CryptoShellScreen";
import { AdminScreen } from "../screens/AdminScreen";
import { TransferScreen } from "../screens/TransferScreen";
import { VnPayReturnScreen } from "../screens/VnPayReturnScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Landing">
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function resolveInitialRoute(
  session: NonNullable<ReturnType<typeof useAuth>["session"]>,
  activeWalletMode: ReturnType<typeof useAuth>["activeWalletMode"],
): keyof RootStackParamList {
  if (session.auth.role === "ADMIN") return "Admin";
  if (activeWalletMode === "fiat") return "Fiat";
  if (activeWalletMode === "crypto") return "Crypto";
  return "WalletType";
}

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["primewallet://"],
  config: {
    screens: {
      VnPayReturn: "vnpay-return",
    },
  },
};

export function AppNavigator() {
  const { loading, session, activeWalletMode } = useAuth();
  const initialRoute = session ? resolveInitialRoute(session, activeWalletMode) : "Auth";
  const navKey = `${loading}-${session?.auth.email ?? "guest"}-${activeWalletMode ?? "none"}`;

  return (
    <NavigationContainer
      linking={linking}
      theme={{
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: "#131313",
          card: "#1b1b1b",
          border: "rgba(255,255,255,0.08)",
          primary: "#fc72ff",
          text: "#ffffff",
        },
      }}
    >
      <Stack.Navigator key={navKey} screenOptions={{ headerShown: false }} initialRouteName={loading ? "Splash" : initialRoute}>
        {loading ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : session ? (
          <>
            <Stack.Screen name="WalletType" component={WalletTypeScreen} options={{ animation: "fade" }} />
            <Stack.Screen name="Fiat" component={FiatShellScreen} />
            <Stack.Screen name="Crypto" component={CryptoShellScreen} />
            <Stack.Screen name="Admin" component={AdminScreen} />
            <Stack.Screen name="VnPayReturn" component={VnPayReturnScreen} />
            <Stack.Screen name="Transfer" component={TransferScreen} options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
