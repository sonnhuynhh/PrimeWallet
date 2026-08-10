import { Modal as RNModal, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { colors } from "../../theme/tokens";
import { useShell } from "../../context/ShellContext";
import { shellTheme } from "../../theme/tokens";

type Props = {
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function Modal({ visible, title, description, onClose, children }: Props) {
  const shell = useShell();
  const theme = shellTheme[shell];

  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.78)" }}>
        <Pressable className="absolute inset-0" onPress={onClose} />
        <View
          className="max-h-[85%] rounded-t-[2rem] border border-border px-5 pb-8 pt-5"
          style={{
            backgroundColor: colors.surface1,
            borderColor: colors.border,
            shadowColor: theme.primary,
            shadowOpacity: 0.15,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <View className="mb-1 h-1 w-10 self-center rounded-full bg-white/20" />
          <View className="mb-4 flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-xl font-extrabold text-white">{title}</Text>
              {description ? <Text className="mt-1 text-sm text-muted-foreground">{description}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12} className="rounded-full bg-white/5 p-2">
              <MaterialCommunityIcons name="close" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </RNModal>
  );
}
