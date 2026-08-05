import { useMemo } from "react";
import { Alert, Text, View } from "react-native";

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

        <Card className="gap-3">
          <Text className="text-xl font-semibold text-white">{session?.profile.fullName ?? session?.auth.fullName}</Text>
          <Text className="text-slate-300">{session?.profile.email ?? session?.auth.email}</Text>
          <Text className="text-slate-300">{session?.profile.phone ?? "-"}</Text>
          <Text className="text-slate-300">KYC: {session?.profile.kycStatus ?? "PENDING"}</Text>
          <Text className="text-slate-300">Trạng thái: {session?.profile.status ?? "ACTIVE"}</Text>
          <Text className="text-slate-300">Ngày tham gia: {joinedAt}</Text>
        </Card>

        <Card className="gap-3">
          <Text className="text-lg font-semibold text-white">Tài khoản hiện tại</Text>
          <Text className="text-slate-300">{session?.account?.accountNumber ?? "Chưa có ví"}</Text>
          <Text className="text-slate-300">{session?.account?.accountType ?? "-"}</Text>
          <Text className="text-slate-300">{session?.account?.currency ?? "VND"}</Text>
        </Card>

        <Button title="Đăng xuất" variant="ghost" onPress={handleLogout} />
      </View>
    </Screen>
  );
}
