import { useMemo } from "react";
import { Alert, Text, View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Screen } from "../components/ui/Screen";
import { useAuth } from "../context/AuthContext";

export function ProfileScreen() {
  const { session, signOut } = useAuth();

  const joinedAt = useMemo(() => {
    const value = session?.profile.createdAt ?? session?.account?.createdAt;
    return value ? new Date(value).toLocaleDateString("vi-VN") : "-";
  }, [session?.profile.createdAt, session?.account?.createdAt]);

  const handleLogout = async () => {
    await signOut();
    Alert.alert("Đã đăng xuất", "Phiên đăng nhập hiện tại đã được xóa");
  };

  return (
    <Screen>
      <View className="flex-1 gap-4 py-4">
        <View>
          <Text className="text-sm uppercase tracking-[0.3em] text-cyan-300">Profile</Text>
          <Text className="mt-2 text-3xl font-black text-white">Thông tin cá nhân</Text>
        </View>

        <Card className="gap-4 border border-cyan-500/20 items-center py-6">
          <View className="bg-cyan-500/20 w-24 h-24 rounded-full items-center justify-center border border-cyan-500/30 mb-2">
            <Ionicons name="person" size={48} color="#67e8f9" />
          </View>
          <View className="items-center">
            <Text className="text-2xl font-bold text-white">{session?.profile.fullName ?? session?.auth.fullName}</Text>
            <Text className="text-slate-400">{session?.profile.email ?? session?.auth.email}</Text>
          </View>
          
          <View className="w-full h-[1px] bg-slate-800 my-2" />
          
          <View className="w-full gap-3">
            <View className="flex-row justify-between items-center">
                <Text className="text-slate-400">Số điện thoại</Text>
                <Text className="text-white font-medium">{session?.profile.phone ?? "-"}</Text>
            </View>
            <View className="flex-row justify-between items-center">
                <Text className="text-slate-400">KYC Status</Text>
                <Text className={`font-bold ${session?.profile.kycStatus === 'VERIFIED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {session?.profile.kycStatus ?? "PENDING"}
                </Text>
            </View>
            <View className="flex-row justify-between items-center">
                <Text className="text-slate-400">Ngày tham gia</Text>
                <Text className="text-white font-medium">{joinedAt}</Text>
            </View>
          </View>
        </Card>

        <Card className="gap-3 border border-slate-700">
          <Text className="text-lg font-semibold text-white mb-2">Tài khoản Fiat</Text>
          <View className="flex-row justify-between items-center">
              <Text className="text-slate-400">Số tài khoản</Text>
              <Text className="text-white font-mono">{session?.account?.accountNumber ?? "Chưa có ví"}</Text>
          </View>
          <View className="flex-row justify-between items-center">
              <Text className="text-slate-400">Loại tài khoản</Text>
              <Text className="text-white">{session?.account?.accountType ?? "-"}</Text>
          </View>
        </Card>

        <TouchableOpacity onPress={handleLogout} className="bg-red-500/10 border border-red-500/30 py-4 rounded-xl flex-row justify-center items-center gap-2 mt-4">
            <Ionicons name="log-out-outline" size={24} color="#f87171" />
            <Text className="text-red-400 font-bold text-lg">Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}
