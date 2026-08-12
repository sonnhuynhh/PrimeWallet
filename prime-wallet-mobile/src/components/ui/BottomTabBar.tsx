import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { shellTheme, type WalletShell } from "../../theme/tokens";

export type BottomTabItem<T extends string> = {
  id: T;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

type Props<T extends string> = {
  shell: WalletShell;
  tabs: readonly BottomTabItem<T>[];
  active: T;
  onChange: (id: T) => void;
};

/** Bottom navigation — chuẩn ví mobile (4–5 tab). */
export function BottomTabBar<T extends string>({ shell, tabs, active, onChange }: Props<T>) {
  const insets = useSafeAreaInsets();
  const theme = shellTheme[shell];

  return (
    <View
      className="flex-row border-t border-border px-2 pt-2"
      style={{
        backgroundColor: "rgba(27,27,27,0.96)",
        paddingBottom: Math.max(insets.bottom, 8),
        borderTopColor: "rgba(255,255,255,0.08)",
      }}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            className="flex-1 items-center gap-1 py-1"
          >
            <View
              className="items-center justify-center rounded-2xl px-3 py-1.5"
              style={{ backgroundColor: selected ? theme.primarySoft : "transparent" }}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={22}
                color={selected ? theme.primary : "#9b9b9b"}
              />
            </View>
            <Text
              className="text-[10px] font-bold"
              style={{ color: selected ? theme.primary : "#9b9b9b" }}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
