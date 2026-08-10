import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { shellTheme } from "../../theme/tokens";

type Props = {
  title: string;
  description: string;
  tagline: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Khung auth — đồng bộ web AuthLayout (glass panel trên nền tối). */
export function AuthLayout({ title, description, tagline, children, footer }: Props) {
  const theme = shellTheme.crypto;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="min-h-full">
      <View className="flex-1 px-6 py-12">
        <View className="mb-10 items-center">
          <View
            className="mb-4 h-16 w-16 items-center justify-center rounded-3xl"
            style={{ backgroundColor: theme.primarySoft }}
          >
            <MaterialCommunityIcons name="wallet" size={32} color={theme.primary} />
          </View>
          <Text className="text-3xl font-extrabold text-white">
            Prime<Text style={{ color: theme.primary }}>Wallet</Text>
          </Text>
          <Text className="mt-3 text-center text-sm leading-6 text-muted-foreground">{tagline}</Text>
        </View>

        <View className="rounded-3xl border border-border bg-surface-1 p-6">
          <Text className="mb-1 text-2xl font-extrabold text-white">{title}</Text>
          <Text className="mb-6 text-sm text-muted-foreground">{description}</Text>
          {children}
        </View>

        {footer ? <View className="mt-6">{footer}</View> : null}
      </View>
    </ScrollView>
  );
}
