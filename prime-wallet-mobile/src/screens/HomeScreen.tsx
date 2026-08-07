import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity, Modal, TextInput, Alert, Linking, ActivityIndicator, AppState } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { Card } from "../components/ui/Card";
import { Screen } from "../components/ui/Screen";
import { CryptoWalletCard } from "../components/ui/CryptoWalletCard";
import { useAuth } from "../context/AuthContext";
import { createPaymentUrl } from "../services/payment";

export function HomeScreen() {
  const { session, activeWalletMode, setActiveWalletMode, reloadSession } = useAuth();
  const navigation = useNavigation<any>();
  const [balance, setBalance] = useState(session?.account?.balance ?? "0");
  
  // VNPAY Modal state
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);

  useEffect(() => {
    setBalance(session?.account?.balance ?? "0");
  }, [session?.account?.balance]);

  // Tự động tải lại số dư khi quay lại ứng dụng (từ trình duyệt VNPAY)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", nextAppState => {
      if (nextAppState === "active") {
        reloadSession();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [reloadSession]);

  const handleDeposit = async () => {
    const amountNum = parseInt(depositAmount.replace(/\D/g, ""));
    if (isNaN(amountNum) || amountNum < 10000) {
      Alert.alert("Lỗi", "Số tiền nạp tối thiểu là 10,000đ");
      return;
    }
    setDepositLoading(true);
    try {
      const res = await createPaymentUrl(amountNum, "Nap tien PrimeWallet");
      setShowDepositModal(false);
      setDepositAmount("");
      if (res.paymentUrl) {
        await Linking.openURL(res.paymentUrl);
      }
    } catch (e: any) {
      Alert.alert("Lỗi nạp tiền", e.message || "Đã xảy ra lỗi");
    } finally {
      setDepositLoading(false);
    }
  };

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
            <View className="flex-row gap-3 mt-2">
              <TouchableOpacity onPress={() => setShowDepositModal(true)} className="flex-1 bg-emerald-500 p-4 rounded-xl items-center">
                <Text className="text-emerald-950 font-bold text-lg">Nạp tiền</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate("Transfer")} className="flex-1 bg-slate-800 p-4 rounded-xl items-center border border-slate-700">
                <Text className="text-emerald-400 font-bold text-lg">Chuyển tiền</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Nạp Tiền VNPAY */}
            <Modal visible={showDepositModal} transparent animationType="fade">
              <View className="flex-1 bg-black/80 justify-center px-6">
                <Card className="gap-4 border border-emerald-500/30">
                  <Text className="text-xl font-bold text-white mb-2">Nạp tiền vào ví (VNPAY)</Text>
                  
                  <View className="gap-2">
                    <Text className="text-slate-400">Số tiền (VND)</Text>
                    <TextInput
                      className="bg-slate-800 text-white p-4 rounded-xl border border-slate-600 text-lg"
                      value={depositAmount}
                      onChangeText={setDepositAmount}
                      placeholder="Nhập số tiền..."
                      placeholderTextColor="#64748b"
                      keyboardType="numeric"
                    />
                  </View>
                  
                  <View className="flex-row gap-3 mt-4">
                    <TouchableOpacity onPress={() => setShowDepositModal(false)} className="flex-1 py-3 items-center rounded-lg border border-slate-600">
                      <Text className="text-slate-300 font-bold">Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDeposit} disabled={depositLoading} className="flex-1 bg-emerald-500 py-3 items-center rounded-lg flex-row justify-center">
                      {depositLoading && <ActivityIndicator color="#064e3b" size="small" style={{ marginRight: 8 }} />}
                      <Text className="text-emerald-950 font-bold">Tiếp tục</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              </View>
            </Modal>
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
