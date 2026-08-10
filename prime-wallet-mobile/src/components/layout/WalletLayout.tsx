import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { shellTheme, type WalletShell } from "../../theme/tokens";

type Props = {
  shell: WalletShell;
  title: string;
  subtitle?: string;
  onSwitchWallet?: () => void;
  onSignOut?: () => void;
  children: ReactNode;
};

/**
 * Chrome ví — đồng bộ với web WalletLayout (header glass + accent theo fiat/crypto).
 */
export function WalletLayout({
  shell,
  title,
  subtitle,
  onSwitchWallet,
  onSignOut,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const theme = shellTheme[shell];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View
        className="border-b border-border px-4 pb-3 pt-2"
        style={{ backgroundColor: "rgba(19, 19, 19, 0.92)" }}
      >
        <View className="flex-row items-center justify-between gap-2">
          <View className="min-w-0 flex-1 flex-row items-center gap-2">
            {onSwitchWallet ? (
              <Pressable
                onPress={onSwitchWallet}
                className="flex-row items-center gap-1 rounded-full border border-border px-3 py-2"
                style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
              >
                <MaterialCommunityIcons name="swap-horizontal" size={16} color={theme.primary} />
                <Text className="text-xs font-semibold text-white">Chuyển ví</Text>
              </Pressable>
            ) : null}
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-extrabold text-white" numberOfLines={1}>
                Prime<Text style={{ color: theme.primary }}>Wallet</Text>
              </Text>
              <Text className="text-[10px] font-bold uppercase tracking-widest" style={{ color: theme.primary }}>
                {title}
              </Text>
            </View>
          </View>

          {onSignOut ? (
            <Pressable onPress={onSignOut} className="rounded-full p-2" hitSlop={8}>
              <MaterialCommunityIcons name="logout" size={22} color="#ff5f52" />
            </Pressable>
          ) : null}
        </View>
        {subtitle ? (
          <Text className="mt-2 text-sm text-muted-foreground" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View className="min-h-0 flex-1">{children}</View>
    </View>
  );
}
