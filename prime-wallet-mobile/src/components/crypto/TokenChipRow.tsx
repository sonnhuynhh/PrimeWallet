import { Pressable, ScrollView, Text } from "react-native";

import { shellTheme } from "../../theme/tokens";

type Props = {
  items: readonly { id: string; label: string }[];
  selectedId?: string;
  onSelect: (id: string) => void;
};

export function TokenChipRow({ items, selectedId, onSelect }: Props) {
  const theme = shellTheme.crypto;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item.id)}
            className="rounded-full border px-4 py-2"
            style={{
              backgroundColor: selected ? theme.primary : "rgba(255,255,255,0.04)",
              borderColor: selected ? theme.primary : "rgba(255,255,255,0.08)",
            }}
          >
            <Text
              className="text-xs font-extrabold"
              style={{ color: selected ? theme.primaryForeground : "#ffffff" }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
