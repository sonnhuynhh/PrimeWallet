import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="absolute -left-24 top-8 h-56 w-56 rounded-full bg-emerald-500/15" />
      <View className="absolute -right-20 top-52 h-64 w-64 rounded-full bg-cyan-400/10" />
      <View className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_40%)]" />
      <View className="flex-1 px-4">{children}</View>
    </SafeAreaView>
  );
}
