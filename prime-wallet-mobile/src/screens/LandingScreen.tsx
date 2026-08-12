import React from "react";
import { ScrollView, Text, View, Pressable, Dimensions } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AuroraBackground } from "../components/effects/AuroraBackground";
import { BorderBeam } from "../components/effects/BorderBeam";
import { CountUp } from "../components/marketing/CountUp";
import { ShellProvider } from "../context/ShellContext";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { shellTheme } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Landing">;

const MARQUEE = ["Swap", "Bridge VND", "NFT", "Non-custodial", "VNPAY", "5 mạng EVM", "AI Insights"];
const STATS = [
  { label: "Người dùng", value: 12000, suffix: "+" },
  { label: "Giao dịch", value: 890000, suffix: "+" },
  { label: "Mạng EVM", value: 5 },
  { label: "Uptime", value: 99.9, suffix: "%", decimals: 1 },
];

const { width } = Dimensions.get("window");

export function LandingScreen({ navigation }: Props) {
  const theme = shellTheme.crypto;

  return (
    <ShellProvider shell="crypto">
    <View className="flex-1 bg-background">
      <AuroraBackground />
      <LinearGradient
        colors={["rgba(252,114,255,0.12)", "transparent"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 400 }}
        pointerEvents="none"
      />

      <ScrollView className="flex-1" contentContainerClassName="pb-12" showsVerticalScrollIndicator={false}>
        {/* Nav */}
        <Animated.View entering={FadeInDown.duration(600)} className="flex-row items-center justify-between px-6 pb-4 pt-14">
          <View className="flex-row items-center gap-2">
            <View className="h-9 w-9 items-center justify-center rounded-2xl" style={{ backgroundColor: theme.primarySoft }}>
              <MaterialCommunityIcons name="wallet" size={18} color={theme.primary} />
            </View>
            <Text className="text-lg font-extrabold text-white">
              Prime<Text style={{ color: theme.primary }}>Wallet</Text>
            </Text>
          </View>
          <Pressable onPress={() => navigation.navigate("Login")} className="rounded-full px-4 py-2">
            <Text className="text-sm font-semibold text-muted-foreground">Đăng nhập</Text>
          </Pressable>
        </Animated.View>

        {/* Hero */}
        <View className="px-6 pb-8">
          <Animated.Text
            entering={FadeInDown.delay(80).duration(700)}
            className="font-extrabold text-white"
            style={{ fontSize: 42, lineHeight: 48 }}
          >
            Prime<Text style={{ color: theme.primary }}>Wallet</Text>
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(160).duration(700)}
            className="mt-4 text-2xl font-bold leading-8 text-white"
          >
            Swap, gửi & giữ tài sản — tiền Việt và on-chain trong một ví.
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(240).duration(700)}
            className="mt-3 text-base leading-6 text-muted-foreground"
          >
            Non-custodial. Khóa riêng không rời thiết bị.
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(320).duration(700)} className="mt-8 flex-row gap-3">
            <Button title="Mở ví" onPress={() => navigation.navigate("Register")} />
            <Pressable onPress={() => navigation.navigate("Login")} className="items-center justify-center rounded-2xl border border-border px-5">
              <Text className="font-bold text-white">Đăng nhập</Text>
            </Pressable>
          </Animated.View>

          {/* Wallet mockup */}
          <Animated.View entering={FadeInDown.delay(400).duration(800)} className="mt-10">
            <BorderBeam>
              <Card className="gap-4 border-0 bg-transparent p-5">
                <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Portfolio</Text>
                <CountUp end={5562} prefix="$" className="text-4xl font-extrabold text-white" />
                <View className="flex-row justify-between">
                  {["ETH", "USDC", "UNI"].map((s) => (
                    <View key={s} className="rounded-xl bg-white/5 px-3 py-2">
                      <Text className="text-xs font-bold text-primary">{s}</Text>
                    </View>
                  ))}
                </View>
                <View className="flex-row gap-2">
                  <View className="flex-1 items-center rounded-xl bg-primary/20 py-2">
                    <Text className="text-xs font-bold text-primary">Swap</Text>
                  </View>
                  <View className="flex-1 items-center rounded-xl bg-white/5 py-2">
                    <Text className="text-xs font-bold text-white">Gửi</Text>
                  </View>
                </View>
              </Card>
            </BorderBeam>
          </Animated.View>
        </View>

        {/* Marquee */}
        <Animated.View entering={FadeInDown.delay(480).duration(700)} className="mb-8 overflow-hidden py-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 24, paddingHorizontal: 24 }}>
            {[...MARQUEE, ...MARQUEE].map((item, i) => (
              <Text key={`${item}-${i}`} className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                {item} ·
              </Text>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Stats */}
        <View className="mb-8 flex-row flex-wrap gap-3 px-6">
          {STATS.map((s, i) => (
            <Animated.View key={s.label} entering={FadeInDown.delay(520 + i * 60).duration(600)} style={{ width: (width - 60) / 2 - 6 }}>
              <Card className="gap-1 border border-border">
                <CountUp end={s.value} suffix={s.suffix ?? ""} decimals={s.decimals ?? 0} className="text-2xl font-extrabold text-primary" />
                <Text className="text-xs text-muted-foreground">{s.label}</Text>
              </Card>
            </Animated.View>
          ))}
        </View>

        {/* Features bento */}
        <View className="mb-8 gap-3 px-6">
          <Text className="text-xl font-extrabold text-white">Tính năng</Text>
          {[
            { icon: "bank" as const, title: "Ví Fiat VND", desc: "Nạp VNPAY, chuyển tiền, hóa đơn" },
            { icon: "ethereum" as const, title: "Ví Crypto Web3", desc: "Swap Uniswap V3, bridge, NFT" },
            { icon: "qrcode-scan" as const, title: "WalletConnect", desc: "MetaMask, Trust, OKX qua QR" },
          ].map((f, i) => (
            <Animated.View key={f.title} entering={FadeInDown.delay(600 + i * 80).duration(600)}>
              <Card className="flex-row items-center gap-3 border border-border">
                <MaterialCommunityIcons name={f.icon} size={24} color={theme.primary} />
                <View className="flex-1">
                  <Text className="font-bold text-white">{f.title}</Text>
                  <Text className="text-xs text-muted-foreground">{f.desc}</Text>
                </View>
              </Card>
            </Animated.View>
          ))}
        </View>

        {/* CTA */}
        <Animated.View entering={FadeInDown.delay(800).duration(700)} className="mx-6">
          <BorderBeam>
            <View className="items-center gap-4 p-6">
              <Text className="text-center text-xl font-extrabold text-white">Sẵn sàng bắt đầu?</Text>
              <Text className="text-center text-sm text-muted-foreground">Tạo ví miễn phí — Fiat & Crypto trong vài phút.</Text>
              <Button title="Đăng ký ngay" onPress={() => navigation.navigate("Register")} />
            </View>
          </BorderBeam>
        </Animated.View>

        <Text className="mt-10 text-center text-xs text-muted-foreground">
          PrimeWallet · {new Date().getFullYear()}
        </Text>
      </ScrollView>
    </View>
    </ShellProvider>
  );
}
