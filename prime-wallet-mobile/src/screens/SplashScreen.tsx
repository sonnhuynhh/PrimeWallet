import { ActivityIndicator, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { ShellBackground } from "../components/layout/ShellBackground";
import { shellTheme } from "../theme/tokens";

export function SplashScreen() {
  const theme = shellTheme.crypto;

  return (
    <ShellBackground shell="crypto">
      <View className="flex-1 items-center justify-center gap-5 px-8">
        <Animated.View entering={FadeIn.duration(600)} className="items-center gap-4">
          <View className="overflow-hidden rounded-[2rem]">
            <LinearGradient
              colors={[theme.primary, "#b478ff"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 88, height: 88, alignItems: "center", justifyContent: "center" }}
            >
              <MaterialCommunityIcons name="wallet" size={40} color={theme.primaryForeground} />
            </LinearGradient>
          </View>
          <Text className="text-3xl font-extrabold text-white">
            Prime<Text style={{ color: theme.primary }}>Wallet</Text>
          </Text>
          <Text className="text-center text-sm text-muted-foreground">Fiat & Crypto trong một ví</Text>
        </Animated.View>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    </ShellBackground>
  );
}
