/**
 * Design tokens — đồng bộ prime-wallet-web/src/index.css
 */

export type WalletShell = "crypto" | "fiat";

export const colors = {
  background: "#131313",
  foreground: "#ffffff",
  card: "rgba(27, 27, 27, 0.88)",
  surface1: "#1b1b1b",
  surface2: "#242424",
  surface3: "#2e2e2e",
  mutedForeground: "#9b9b9b",
  border: "rgba(255, 255, 255, 0.08)",
  input: "rgba(255, 255, 255, 0.1)",
  destructive: "#ff5f52",
  success: "#21c95e",
  warning: "#ffbf17",
  accent2: "#4c82fb",
} as const;

export const shellTheme: Record<
  WalletShell,
  { primary: string; primaryForeground: string; primarySoft: string; ring: string }
> = {
  crypto: {
    primary: "#fc72ff",
    primaryForeground: "#1a001f",
    primarySoft: "rgba(252, 114, 255, 0.14)",
    ring: "#fc72ff",
  },
  fiat: {
    primary: "#21c95e",
    primaryForeground: "#04160b",
    primarySoft: "rgba(33, 201, 94, 0.14)",
    ring: "#4ade80",
  },
};

export const typography = {
  fontSans: "BeVietnamPro_400Regular",
  fontSansMedium: "BeVietnamPro_500Medium",
  fontSansSemiBold: "BeVietnamPro_600SemiBold",
  fontSansBold: "BeVietnamPro_700Bold",
  fontDisplay: "Syne_700Bold",
  fontDisplayExtra: "Syne_800ExtraBold",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  x2: 40,
} as const;

export const radii = {
  lg: 20,
  xl: 24,
  x2: 32,
  x3: 40,
  full: 9999,
} as const;
