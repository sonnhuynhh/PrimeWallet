import { Pressable, ScrollView, Text } from "react-native";

import { shellTheme } from "../../theme/tokens";

type Props<T extends string> = {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
};

export function SegmentToggle<T extends string>({ options, value, onChange }: Props<T>) {
  const theme = shellTheme.crypto;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            className="rounded-full border px-4 py-2"
            style={{
              backgroundColor: selected ? theme.primarySoft : "rgba(255,255,255,0.04)",
              borderColor: selected ? `${theme.primary}55` : "rgba(255,255,255,0.08)",
            }}
          >
            <Text className="text-xs font-bold" style={{ color: selected ? theme.primary : "#9b9b9b" }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
