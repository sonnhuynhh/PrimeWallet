import { ActivityIndicator, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";

import { useShell } from "../../context/ShellContext";
import { colors, shellTheme } from "../../theme/tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "white";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  shell?: "crypto" | "fiat";
  style?: StyleProp<ViewStyle>;
};

const SIZES: Record<ButtonSize, { py: number; px: number; text: string }> = {
  sm: { py: 8, px: 16, text: "text-sm" },
  md: { py: 12, px: 24, text: "text-sm" },
  lg: { py: 14, px: 28, text: "text-base" },
};

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  size = "md",
  fullWidth = true,
  shell: shellProp,
  style,
}: ButtonProps) {
  const shellCtx = useShell();
  const shell = shellProp ?? shellCtx;
  const theme = shellTheme[shell];
  const sz = SIZES[size];

  const bg =
    variant === "primary"
      ? theme.primary
      : variant === "secondary"
        ? colors.surface2
        : variant === "danger"
          ? "rgba(255,95,82,0.12)"
          : variant === "white"
            ? "#ffffff"
            : "transparent";

  const textColor =
    variant === "primary"
      ? theme.primaryForeground
      : variant === "danger"
        ? "#ff5f52"
        : variant === "white"
          ? "#131313"
          : variant === "outline"
            ? theme.primary
            : "#ffffff";

  const borderColor =
    variant === "outline"
      ? `${theme.primary}80`
      : variant === "secondary"
        ? colors.border
        : variant === "danger"
          ? "rgba(255,95,82,0.3)"
          : "transparent";

  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={[
        {
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 9999,
          paddingVertical: sz.py,
          paddingHorizontal: sz.px,
          backgroundColor: bg,
          borderWidth: variant === "ghost" ? 0 : 1,
          borderColor,
          opacity: loading || disabled ? 0.5 : 1,
          width: fullWidth ? "100%" : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text className={`${sz.text} font-semibold`} style={{ color: textColor }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
