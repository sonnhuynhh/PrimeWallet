import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { ShellBackground } from "../layout/ShellBackground";
import { useShell } from "../../context/ShellContext";

type Props = {
  children: React.ReactNode;
  title?: string;
  onClose?: () => void;
  shell?: "crypto" | "fiat";
};

/** Full-screen container — thay legacy slate/emerald. */
export function Screen({ children, title, onClose }: Props) {
  const shell = useShell();

  return (
    <ShellBackground shell={shell}>
      <SafeAreaView className="flex-1" edges={["top", "left", "right"]}>
        {title || onClose ? (
          <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
            {onClose ? (
              <Pressable onPress={onClose} hitSlop={12} className="rounded-full bg-white/5 p-2">
                <MaterialCommunityIcons name="close" size={22} color="#9b9b9b" />
              </Pressable>
            ) : (
              <View className="w-10" />
            )}
            {title ? <Text className="text-lg font-extrabold text-white">{title}</Text> : null}
            <View className="w-10" />
          </View>
        ) : null}
        <View className="flex-1 px-4">{children}</View>
      </SafeAreaView>
    </ShellBackground>
  );
}
