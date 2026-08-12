import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { shortAddress } from "../../lib/utils";
import { useShell } from "../../context/ShellContext";
import { shellTheme } from "../../theme/tokens";

type Props = {
  value: string;
  onCopy: () => void;
  label?: string;
};

export function CopyField({ value, onCopy, label = "Địa chỉ ví" }: Props) {
  const shell = useShell();
  const theme = shellTheme[shell];

  return (
    <View className="w-full gap-2">
      <Text className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</Text>
      <Pressable
        onPress={onCopy}
        className="flex-row items-center gap-3 rounded-2xl border border-border px-4 py-3"
        style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
      >
        <Text className="min-w-0 flex-1 font-mono text-sm text-white" numberOfLines={1} ellipsizeMode="middle">
          {shortAddress(value, 10, 8)}
        </Text>
        <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: theme.primarySoft }}>
          <MaterialCommunityIcons name="content-copy" size={14} color={theme.primary} />
          <Text className="text-xs font-bold" style={{ color: theme.primary }}>
            Sao chép
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
