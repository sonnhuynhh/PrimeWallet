import { useState } from "react";
import { Alert, Text, View } from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Screen } from "../components/ui/Screen";
import { useAuth } from "../context/AuthContext";
import { transfer } from "../services/wallet";
import { createIdempotencyKey } from "../utils/uuid";

export function TransferScreen() {
  const { session, reloadSession } = useAuth();
  const [destinationAccountNumber, setDestinationAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    setLoading(true);
    try {
      await transfer({
        idempotencyKey: createIdempotencyKey(),
        destinationAccountNumber,
        amount,
        description,
      });
      await reloadSession();
      Alert.alert("Thành công", "Giao dịch chuyển tiền đã được tạo");
      setDestinationAccountNumber("");
      setAmount("");
      setDescription("");
    } catch (error) {
      Alert.alert("Chuyển tiền thất bại", error instanceof Error ? error.message : "Vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View className="flex-1 gap-4 py-4">
        <View>
          <Text className="text-sm uppercase tracking-[0.3em] text-cyan-300">Transfer</Text>
          <Text className="mt-2 text-3xl font-black text-white">Chuyển tiền nội bộ</Text>
        </View>

        <Card className="gap-4">
          <Input label="Số tài khoản nhận" value={destinationAccountNumber} onChangeText={setDestinationAccountNumber} placeholder="PW00001234" />
          <Input label="Số tiền" value={amount} onChangeText={setAmount} placeholder="100000" keyboardType="numeric" />
          <Input label="Nội dung" value={description} onChangeText={setDescription} placeholder="Tiền ăn trưa" multiline />
          <Button title="Thực hiện chuyển tiền" onPress={handleTransfer} loading={loading} />
        </Card>

        <Card>
          <Text className="text-sm leading-6 text-slate-300">Ví hiện tại: {session?.account?.accountNumber ?? "Chưa tải dữ liệu ví"}</Text>
        </Card>
      </View>
    </Screen>
  );
}
