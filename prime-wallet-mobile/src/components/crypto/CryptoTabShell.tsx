import type { ReactNode } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

type Props = ScrollViewProps & { children: ReactNode };

/** Wrapper scroll thống nhất cho các tab crypto. */
export function CryptoTabShell({ children, className = "", ...rest }: Props) {
  return (
    <ScrollView
      className={`flex-1 px-4 py-4 ${className}`}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {children}
    </ScrollView>
  );
}
