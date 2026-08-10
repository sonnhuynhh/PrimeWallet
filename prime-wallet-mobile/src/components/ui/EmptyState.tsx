import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Button } from "./Button";
import { useShell } from "../../context/ShellContext";
import { shellTheme } from "../../theme/tokens";

type Props = {
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
};

export function EmptyState({ icon = "wallet-outline", title, description, actionLabel, onAction, children }: Props) {
  const shell = useShell();
  const theme = shellTheme[shell];

  return (
    <View className="items-center gap-4 px-6 py-12">
      <View
        className="h-16 w-16 items-center justify-center rounded-3xl"
        style={{ backgroundColor: theme.primarySoft }}
      >
        <MaterialCommunityIcons name={icon} size={32} color={theme.primary} />
      </View>
      <Text className="text-center text-lg font-bold text-white">{title}</Text>
      {description ? <Text className="text-center text-sm text-muted-foreground">{description}</Text> : null}
      {children}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} fullWidth={false} size="sm" />
      ) : null}
    </View>
  );
}
