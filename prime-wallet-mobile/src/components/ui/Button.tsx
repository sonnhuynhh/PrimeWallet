import { ActivityIndicator, Pressable, Text } from "react-native";

type ButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "ghost";
};

export function Button({ title, onPress, loading, variant = "primary" }: ButtonProps) {
  const baseClass = variant === "primary" ? "bg-emerald-400" : "border border-white/10 bg-white/5";

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      className={`items-center justify-center rounded-2xl px-4 py-3 ${baseClass} ${loading ? "opacity-70" : "opacity-100"}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#08111f" : "#ffffff"} />
      ) : (
        <Text className={variant === "primary" ? "font-semibold text-slate-950" : "font-semibold text-white"}>{title}</Text>
      )}
    </Pressable>
  );
}
