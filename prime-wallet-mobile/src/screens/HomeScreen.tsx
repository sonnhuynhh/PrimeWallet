import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Card } from "../components/ui/Card";
import { Screen } from "../components/ui/Screen";
import { CryptoWalletCard } from "../components/ui/CryptoWalletCard";
import { useAuth } from "../context/AuthContext";

export function HomeScreen() {
  const { session, activeWalletMode, setActiveWalletMode } = useAuth();
  const [balance, setBalance] = useState(session?.account?.balance ?? "0");

  useEffect(() => {
    setBalance(session?.account?.balance ?? "0");
  }, [session?.account?.balance]);

  const fullName = session?.profile.fullName ?? session?.auth.fullName ?? "Khách";

  // Màn hình 1: Chọn Ví (Wallet Selector)
  if (!activeWalletMode) {
    return (
      <Screen>
        <View className="flex-1 gap-6 py-8 justify-center">
          <View className="items-center mb-4">
            <Text className="text-sm uppercase tracking-[0.3em] text-emerald-300">Welcome back</Text>
            <Text className="mt-2 text-3xl font-black text-white">Xin chào, {fullName}</Text>
            <Text className="mt-2 text-slate-400 text-center px-4">
              Bạn muốn sử dụng ví nào hôm nay?
            </Text>
          </View>

          <TouchableOpacity onPress={() => setActiveWalletMode("fiat")}>
            <Card className="gap-3 bg-emerald-500/10 border border-emerald-500/30 items-center py-8 rounded-3xl">
              <Ionicons name="wallet-outline" size={48} color="#34d399" />
              <Text className="text-2xl font-black text-white">Ví Truyền Thống</Text>
              <Text className="text-emerald-200">Giao dịch VND & Thẻ tín dụng ảo</Text>
            </Card>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setActiveWalletMode("crypto")}>
            <Card className="gap-3 bg-violet-500/10 border border-violet-500/30 items-center py-8 rounded-3xl">
              <Ionicons name="planet-outline" size={48} color="#a78bfa" />
              <Text className="text-2xl font-black text-white">Ví Web3</Text>
              <Text className="text-violet-200">Tự quản lý tài sản Crypto (Non-custodial)</Text>
            </Card>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  // Màn hình 2: Bảng Điều Khiển (Dashboard) của Ví đã chọn
  return (
    <Screen>
      <View className="flex-1 gap-4 py-4">
        {/* Header với nút Đổi Ví */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm uppercase tracking-[0.3em] text-slate-400">Dashboard</Text>
            <Text className="mt-2 text-2xl font-black text-white">
              {activeWalletMode === "fiat" ? "Ví VND" : "Ví Crypto"}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => setActiveWalletMode(null)}
            className="bg-slate-800 px-4 py-2 rounded-full border border-slate-700 flex-row items-center gap-2"
          >
            <Ionicons name="swap-horizontal" size={16} color="#94a3b8" />
            <Text className="text-slate-300 font-semibold">Đổi Ví</Text>
          </TouchableOpacity>
        </View>

        {/* Fiat Wallet Content */}
        {activeWalletMode === "fiat" && (
          <View className="gap-4 mt-2">
            <Card className="gap-4 bg-emerald-400/10 border border-emerald-500/20">
              <Text className="text-sm text-emerald-200">Số dư khả dụng (VND)</Text>
              <Text className="text-4xl font-black text-white">
                {Number(balance).toLocaleString("vi-VN")} <Text className="text-2xl text-emerald-400">₫</Text>
              </Text>
              <Text className="text-sm text-slate-300">Số tài khoản: {session?.account?.accountNumber ?? "Chưa có ví"}</Text>
            </Card>

            <View className="flex-row gap-3">
              <Card className="flex-1 gap-2 border border-slate-700">
                <Text className="text-xs uppercase tracking-[0.2em] text-slate-400">KYC</Text>
                <Text className="text-lg font-semibold text-white">{session?.profile.kycStatus ?? "PENDING"}</Text>
              </Card>
              <Card className="flex-1 gap-2 border border-slate-700">
                <Text className="text-xs uppercase tracking-[0.2em] text-slate-400">Trạng thái</Text>
                <Text className="text-lg font-semibold text-emerald-400">{session?.profile.status ?? "ACTIVE"}</Text>
              </Card>
            </View>
            
            <Card className="gap-3 border border-slate-700">
                <Text className="text-lg font-semibold text-white">Tính năng Fiat</Text>
                <Text className="leading-6 text-slate-300">Tính năng Nạp tiền VNPAY và Chuyển tiền nội bộ đang được hoàn thiện.</Text>
            </Card>
          </View>
        )}

        {/* Crypto Wallet Content */}
        {activeWalletMode === "crypto" && (
          <View className="mt-2">
            <CryptoWalletCard />
          </View>
        )}
      </View>
    </Screen>
  );
}
