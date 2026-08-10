import { Text, View } from "react-native";

type Variant = "default" | "success" | "warning" | "danger" | "primary";

const styles: Record<Variant, { bg: string; text: string }> = {
  default: { bg: "rgba(255,255,255,0.08)", text: "#d4d4d4" },
  success: { bg: "rgba(33,201,94,0.15)", text: "#4ade80" },
  warning: { bg: "rgba(255,191,23,0.15)", text: "#fbbf24" },
  danger: { bg: "rgba(255,95,82,0.15)", text: "#fb7185" },
  primary: { bg: "rgba(252,114,255,0.15)", text: "#fc72ff" },
};

export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: Variant;
}) {
  const s = styles[variant];
  return (
    <View className="self-start rounded-full px-2.5 py-1" style={{ backgroundColor: s.bg }}>
      <Text className="text-[10px] font-bold uppercase tracking-wide" style={{ color: s.text }}>
        {children}
      </Text>
    </View>
  );
}
