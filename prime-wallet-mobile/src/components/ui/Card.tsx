import type { ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { colors } from "../../theme/tokens";
import { useShell } from "../../context/ShellContext";
import { shellTheme } from "../../theme/tokens";

type CardProps = {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
  bare?: boolean;
  interactive?: boolean;
};

export function Card({ children, className = "", style, bare, interactive }: CardProps) {
  return (
    <View
      className={`overflow-hidden rounded-3xl border border-border ${bare ? "" : "p-5"} ${className}`}
      style={[
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardHeader({
  title,
  description,
  icon,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  const shell = useShell();
  const theme = shellTheme[shell];

  return (
    <View className="mb-4 flex-row items-start justify-between gap-3">
      <View className="min-w-0 flex-1 flex-row items-start gap-3">
        {icon ? (
          <View
            className="h-10 w-10 items-center justify-center rounded-2xl"
            style={{ backgroundColor: theme.primarySoft }}
          >
            {icon}
          </View>
        ) : null}
        <View className="min-w-0 flex-1">
          <Text className="text-lg font-bold text-white">{title}</Text>
          {description ? <Text className="mt-0.5 text-sm text-muted-foreground">{description}</Text> : null}
        </View>
      </View>
      {action}
    </View>
  );
}
