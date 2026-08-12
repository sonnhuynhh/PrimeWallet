import type { ReactNode } from "react";
import { Text, TextInput, View, type KeyboardTypeOptions } from "react-native";

import { colors } from "../../theme/tokens";

type InputProps = {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  error?: string | null;
  hint?: string;
  suffix?: ReactNode;
  prefix?: ReactNode;
  editable?: boolean;
};

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = "default",
  multiline,
  error,
  hint,
  suffix,
  prefix,
  editable = true,
}: InputProps) {
  return (
    <View className="w-full gap-2">
      {label ? (
        <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</Text>
      ) : null}
      <View
        className="flex-row items-center rounded-2xl border"
        style={{
          backgroundColor: `${colors.surface2}e6`,
          borderColor: error ? "rgba(251,113,133,0.7)" : colors.border,
        }}
      >
        {prefix ? <View className="pl-4">{prefix}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={`${colors.mutedForeground}88`}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          editable={editable}
          className={`flex-1 p-4 text-white ${multiline ? "min-h-[96px]" : ""}`}
          style={{ textAlignVertical: multiline ? "top" : "center" }}
        />
        {suffix ? <View className="pr-3">{suffix}</View> : null}
      </View>
      {error ? (
        <Text className="text-xs text-rose-400">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-muted-foreground">{hint}</Text>
      ) : null}
    </View>
  );
}
