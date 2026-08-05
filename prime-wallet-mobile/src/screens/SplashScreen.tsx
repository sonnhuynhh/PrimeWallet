import { ActivityIndicator, Text, View } from "react-native";

import { Screen } from "../components/ui/Screen";

export function SplashScreen() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-4">
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-emerald-400">
          <Text className="text-2xl font-black text-slate-950">PW</Text>
        </View>
        <Text className="text-2xl font-semibold text-white">Prime Wallet</Text>
        <ActivityIndicator color="#34d399" />
      </View>
    </Screen>
  );
}
