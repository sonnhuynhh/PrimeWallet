import { View, Text, Pressable, ScrollView } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { useAuth } from "../context/AuthContext";
import { shellTheme } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "WalletType">;

const OPTIONS = [
  {
    mode: "fiat" as const,
    icon: "bank" as const,
    title: "Ví Fiat",
    suffix: "VND",
    description: "Nạp VNPAY, chuyển tiền, thanh toán hóa đơn.",
    shell: "fiat" as const,
  },
  {
    mode: "crypto" as const,
    icon: "ethereum" as const,
    title: "Ví Crypto",
    suffix: "Web3",
    description: "Swap, bridge VND, NFT — 5 mạng EVM.",
    shell: "crypto" as const,
  },
];

export function WalletTypeScreen({ navigation }: Props) {
  const { session, setActiveWalletMode, signOut } = useAuth();

  const choose = async (mode: "fiat" | "crypto") => {
    await setActiveWalletMode(mode);
    navigation.replace(mode === "fiat" ? "Fiat" : "Crypto");
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-5 pb-10 pt-14">
      <View className="mb-8 flex-row items-center justify-between">
        <Text className="text-2xl font-extrabold text-white">
          Prime<Text className="text-primary">Wallet</Text>
        </Text>
        <Pressable onPress={() => signOut()} className="rounded-full p-2">
          <MaterialCommunityIcons name="logout" size={22} color="#ff5f52" />
        </Pressable>
      </View>

      <Text className="mb-2 text-3xl font-extrabold text-white">Chọn loại ví</Text>
      <Text className="mb-8 text-base text-muted-foreground">
        Xin chào {session?.profile.fullName?.split(" ").pop() ?? ""} — bạn muốn dùng ví nào?
      </Text>

      {OPTIONS.map((opt) => {
        const theme = shellTheme[opt.shell];
        return (
          <Pressable
            key={opt.mode}
            onPress={() => choose(opt.mode)}
            className="mb-4 overflow-hidden rounded-3xl border border-border p-5"
            style={{ backgroundColor: "rgba(27,27,27,0.95)" }}
          >
            <View className="mb-3 flex-row items-center justify-between">
              <View
                className="h-12 w-12 items-center justify-center rounded-2xl"
                style={{ backgroundColor: theme.primarySoft }}
              >
                <MaterialCommunityIcons name={opt.icon} size={26} color={theme.primary} />
              </View>
              <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {opt.suffix}
              </Text>
            </View>
            <Text className="mb-1 text-xl font-extrabold text-white">{opt.title}</Text>
            <Text className="text-sm leading-5 text-muted-foreground">{opt.description}</Text>
          </Pressable>
        );
      })}

      {session?.auth.role === "ADMIN" ? (
        <Pressable
          onPress={() => navigation.navigate("Admin")}
          className="mt-2 flex-row items-center justify-center gap-2 rounded-full border border-rose-500/30 py-3"
          style={{ backgroundColor: "rgba(244,63,94,0.1)" }}
        >
          <MaterialCommunityIcons name="shield-alert" size={18} color="#fb7185" />
          <Text className="font-bold text-rose-400">Quản trị hệ thống</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
