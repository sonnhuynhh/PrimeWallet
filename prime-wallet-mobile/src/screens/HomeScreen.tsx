import { useEffect, useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
  AppState,
  ScrollView,
  Pressable,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { Card } from "../components/ui/Card";
import { Modal as AppModal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { AiInsightsPanel } from "../components/ai/AiInsightsPanel";
import { useAuth } from "../context/AuthContext";
import { createPaymentUrl } from "../services/payment";
import { withdraw } from "../services/wallet";
import { createIdempotencyKey } from "../utils/uuid";
import { toastErr, toastOk } from "../components/feedback/toast";
import { fmtVnd } from "../lib/utils";
import { shellTheme } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

const BILL_PROVIDERS = ["Điện lực EVN", "Nước sạch Sawaco", "Internet VNPT", "Internet FPT"] as const;

export function HomeScreen() {
  const { session, reloadSession, setActiveWalletMode } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = shellTheme.fiat;
  const [balance, setBalance] = useState(session?.account?.balance ?? "0");
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showBillModal, setShowBillModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDesc, setWithdrawDesc] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [billProvider, setBillProvider] = useState<string>(BILL_PROVIDERS[0]);
  const [billCode, setBillCode] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billLoading, setBillLoading] = useState(false);

  useEffect(() => {
    setBalance(session?.account?.balance ?? "0");
  }, [session?.account?.balance]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void reloadSession();
    });
    return () => subscription.remove();
  }, [reloadSession]);

  const handleDeposit = async () => {
    const amountNum = parseInt(depositAmount.replace(/\D/g, ""), 10);
    if (Number.isNaN(amountNum) || amountNum < 10000) {
      Alert.alert("Lỗi", "Số tiền nạp tối thiểu là 10,000đ");
      return;
    }
    setDepositLoading(true);
    try {
      const res = await createPaymentUrl(amountNum, "Nap tien PrimeWallet");
      setShowDepositModal(false);
      setDepositAmount("");
      if (res.paymentUrl) await Linking.openURL(res.paymentUrl);
      toastOk("Đã mở VNPAY", "Hoàn tất thanh toán để cộng tiền vào ví.");
    } catch (e) {
      toastErr(e, "Lỗi nạp tiền");
    } finally {
      setDepositLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const amountNum = parseInt(withdrawAmount.replace(/\D/g, ""), 10);
    if (Number.isNaN(amountNum) || amountNum < 10000) {
      Alert.alert("Lỗi", "Số tiền rút tối thiểu là 10,000đ");
      return;
    }
    setWithdrawLoading(true);
    try {
      await withdraw({
        idempotencyKey: createIdempotencyKey(),
        amount: String(amountNum),
        description: withdrawDesc.trim() || "Rút tiền về ngân hàng",
      });
      await reloadSession();
      toastOk("Yêu cầu rút tiền đã gửi", fmtVnd(amountNum));
      setShowWithdrawModal(false);
      setWithdrawAmount("");
      setWithdrawDesc("");
    } catch (e) {
      toastErr(e, "Rút tiền thất bại");
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleBill = async () => {
    if (!billCode || !billAmount) return;
    setBillLoading(true);
    try {
      await withdraw({
        idempotencyKey: createIdempotencyKey(),
        amount: billAmount,
        description: `Thanh toán hóa đơn ${billProvider} - Mã: ${billCode}`,
      });
      await reloadSession();
      toastOk("Thanh toán hóa đơn thành công", `${billProvider} · ${fmtVnd(Number(billAmount))}`);
      setShowBillModal(false);
      setBillCode("");
      setBillAmount("");
    } catch (e) {
      toastErr(e, "Thanh toán hóa đơn thất bại");
    } finally {
      setBillLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
      <Card className="mb-4 gap-3 border" style={{ backgroundColor: theme.primarySoft, borderColor: `${theme.primary}33` }}>
        <Text className="text-sm font-semibold" style={{ color: theme.primary }}>Số dư khả dụng</Text>
        <Text className="text-4xl font-extrabold text-white">
          {fmtVnd(Number(balance))} <Text className="text-2xl" style={{ color: theme.primary }}>₫</Text>
        </Text>
        <Text className="text-sm text-muted-foreground">STK: {session?.account?.accountNumber ?? "—"}</Text>
      </Card>

      <View className="mb-4 flex-row gap-3">
        <Card className="flex-1 gap-1 border border-border">
          <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">KYC</Text>
          <Text className="text-base font-bold text-white">{session?.profile.kycStatus ?? "PENDING"}</Text>
        </Card>
        <Card className="flex-1 gap-1 border border-border">
          <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Trạng thái</Text>
          <Text className="text-base font-bold" style={{ color: theme.primary }}>{session?.profile.status ?? "ACTIVE"}</Text>
        </Card>
      </View>

      <View className="mb-3 flex-row gap-2">
        <ActionBtn theme={theme} icon="plus" label="Nạp" onPress={() => setShowDepositModal(true)} primary />
        <ActionBtn theme={theme} icon="bank-transfer" label="Chuyển" onPress={() => navigation.navigate("Transfer")} />
        <ActionBtn theme={theme} icon="cash-minus" label="Rút" onPress={() => setShowWithdrawModal(true)} />
        <ActionBtn theme={theme} icon="receipt" label="Hóa đơn" onPress={() => setShowBillModal(true)} warning />
      </View>

      <Pressable
        onPress={() => {
          void setActiveWalletMode("crypto");
          navigation.navigate("Crypto");
        }}
        className="mb-4 flex-row items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3"
      >
        <Text className="font-bold text-primary">Đổi Crypto → VND (Bridge)</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color="#fc72ff" />
      </Pressable>

      <AiInsightsPanel />

      <AppModal visible={showDepositModal} title="Nạp tiền (VNPAY)" onClose={() => setShowDepositModal(false)}>
        <Input label="Số tiền (VND)" value={depositAmount} onChangeText={setDepositAmount} keyboardType="numeric" placeholder="Tối thiểu 10.000đ" />
        <Button title="Tiếp tục" onPress={() => void handleDeposit()} loading={depositLoading} />
      </AppModal>

      <AppModal visible={showWithdrawModal} title="Rút tiền" onClose={() => setShowWithdrawModal(false)}>
        <Input label="Số tiền (VND)" value={withdrawAmount} onChangeText={setWithdrawAmount} keyboardType="numeric" placeholder="Tối thiểu 10.000đ" />
        <Input label="Ghi chú" value={withdrawDesc} onChangeText={setWithdrawDesc} placeholder="Rút về ngân hàng liên kết" />
        <Button title="Xác nhận rút" onPress={() => void handleWithdraw()} loading={withdrawLoading} />
      </AppModal>

      <AppModal visible={showBillModal} title="Thanh toán hóa đơn" onClose={() => setShowBillModal(false)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 flex-row gap-2">
          {BILL_PROVIDERS.map((p) => (
            <Pressable key={p} onPress={() => setBillProvider(p)} className="mr-2 rounded-full border border-border px-3 py-2" style={{ backgroundColor: billProvider === p ? theme.primarySoft : "transparent" }}>
              <Text className="text-xs font-bold text-white">{p}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Input label="Mã khách hàng" value={billCode} onChangeText={setBillCode} />
        <Input label="Số tiền (VND)" value={billAmount} onChangeText={setBillAmount} keyboardType="numeric" />
        <Button title="Thanh toán" onPress={() => void handleBill()} loading={billLoading} />
      </AppModal>
    </ScrollView>
  );
}

function ActionBtn({
  theme,
  icon,
  label,
  onPress,
  primary,
  warning,
}: {
  theme: (typeof shellTheme)["fiat"];
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  warning?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-1 items-center justify-center gap-1 rounded-2xl py-3"
      style={{
        backgroundColor: primary ? theme.primary : warning ? "rgba(255,191,23,0.12)" : "rgba(255,255,255,0.03)",
        borderWidth: primary ? 0 : 1,
        borderColor: warning ? "rgba(255,191,23,0.3)" : "rgba(255,255,255,0.08)",
      }}
    >
      <MaterialCommunityIcons name={icon} size={20} color={primary ? theme.primaryForeground : warning ? "#fbbf24" : theme.primary} />
      <Text className="text-xs font-extrabold" style={{ color: primary ? theme.primaryForeground : warning ? "#fbbf24" : theme.primary }}>{label}</Text>
    </TouchableOpacity>
  );
}
