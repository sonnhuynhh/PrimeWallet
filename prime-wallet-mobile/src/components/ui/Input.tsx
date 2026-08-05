import { Text, TextInput, View } from "react-native";

type InputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  multiline?: boolean;
  error?: string;
};

export function Input({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType = "default", multiline, error }: InputProps) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-slate-300">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        className={`rounded-2xl border px-4 py-3 text-white ${multiline ? "min-h-[96px]" : ""} ${error ? "border-red-400/70 bg-red-500/10" : "border-white/10 bg-white/5"}`}
      />
      {error ? <Text className="text-xs text-red-300">{error}</Text> : null}
    </View>
  );
}
