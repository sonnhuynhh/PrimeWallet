import { View } from "react-native";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <View className={`rounded-3xl border border-white/10 bg-white/5 p-4 ${className}`}>{children}</View>;
}
