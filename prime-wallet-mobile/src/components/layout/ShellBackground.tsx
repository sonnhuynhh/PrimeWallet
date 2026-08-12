import type { ReactNode } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { AuroraBackground } from "../effects/AuroraBackground";
import type { WalletShell } from "../../theme/tokens";
const GLOW: Record<WalletShell, string> = {
  crypto: "rgba(252,114,255,0.16)",
  fiat: "rgba(33,201,94,0.14)",
};

export function ShellBackground({ shell, children }: { shell: WalletShell; children: ReactNode }) {
  return (
    <View className="flex-1 bg-background">
      <AuroraBackground />
      <LinearGradient
        colors={[GLOW[shell], "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 280 }}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}
