import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { Card } from "../components/ui/Card";
import { Screen } from "../components/ui/Screen";
import { useAuth } from "../context/AuthContext";

export function HomeScreen() {
  const { session } = useAuth();
  const [balance, setBalance] = useState(session?.account?.balance ?? "0");

  useEffect(() => {
    setBalance(session?.account?.balance ?? "0");
  }, [session?.account?.balance]);

  const fullName = session?.profile.fullName ?? session?.auth.fullName ?? "Khách";

  return (
    <Screen>
      <View className="flex-1 gap-4 py-4">
        <View>
          <Text className="text-sm uppercase tracking-[0.3em] text-emerald-300">Dashboard</Text>
          <Text className="mt-2 text-3xl font-black text-white">Xin chào, {fullName}</Text>
        </View>

        <Card className="gap-4 bg-emerald-400/10">
          <Text className="text-sm text-emerald-200">Số dư khả dụng</Text>
          <Text className="text-4xl font-black text-white">{Number(balance).toLocaleString("vi-VN")} {session?.account?.currency ?? "VND"}</Text>
          <Text className="text-sm text-slate-300">Số tài khoản: {session?.account?.accountNumber ?? "Chưa có ví"}</Text>
        </Card>

        <View className="flex-row gap-3">
          <Card className="flex-1 gap-2">
            <Text className="text-xs uppercase tracking-[0.2em] text-slate-400">KYC</Text>
            <Text className="text-lg font-semibold text-white">{session?.profile.kycStatus ?? "PENDING"}</Text>
          </Card>
          <Card className="flex-1 gap-2">
            <Text className="text-xs uppercase tracking-[0.2em] text-slate-400">Trạng thái</Text>
            <Text className="text-lg font-semibold text-white">{session?.profile.status ?? "ACTIVE"}</Text>
          </Card>
        </View>

        <Card className="gap-3">
          <Text className="text-lg font-semibold text-white">Lộ trình giai đoạn đầu</Text>
          <Text className="leading-6 text-slate-300">Màn hình này sẽ sớm ghép lịch sử giao dịch, top-up, rút tiền và phân tích dòng tiền.</Text>
        </Card>
      </View>
    </Screen>
  );
}
