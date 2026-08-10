import { ScrollView, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { shellTheme, type WalletShell } from "../../theme/tokens";

export type TabItem<T extends string> = {
  id: T;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

type Props<T extends string> = {
  shell: WalletShell;
  tabs: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
};

/** Tab bar ngang — đồng bộ web TabBar (scroll trên mobile). */
export function TabBar<T extends string>({ shell, tabs, active, onChange }: Props<T>) {
  const theme = shellTheme[shell];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="border-b border-border"
      contentContainerClassName="gap-2 px-4 py-3"
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            className="flex-row items-center gap-1.5 rounded-full border px-3 py-2"
            style={{
              backgroundColor: selected ? theme.primarySoft : "rgba(255,255,255,0.03)",
              borderColor: selected ? `${theme.primary}55` : "rgba(255,255,255,0.08)",
            }}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={14}
              color={selected ? theme.primary : "#9b9b9b"}
            />
            <Text
              className="text-xs font-bold"
              style={{ color: selected ? theme.primary : "#9b9b9b" }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
