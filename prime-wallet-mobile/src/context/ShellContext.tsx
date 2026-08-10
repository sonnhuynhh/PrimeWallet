import { createContext, useContext, type ReactNode } from "react";

import type { WalletShell } from "../theme/tokens";

const ShellContext = createContext<WalletShell>("crypto");

export function ShellProvider({ shell, children }: { shell: WalletShell; children: ReactNode }) {
  return <ShellContext.Provider value={shell}>{children}</ShellContext.Provider>;
}

export function useShell() {
  return useContext(ShellContext);
}
