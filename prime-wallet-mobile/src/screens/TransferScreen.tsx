import { useState } from "react";
import { Alert, Text, View, TouchableOpacity, ScrollView } from "react-native";
import { ethers } from "ethers";
import { getPrivateKey } from "../storage/secureKeyStore";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Screen } from "../components/ui/Screen";
import { useAuth } from "../context/AuthContext";
import { transfer } from "../services/wallet";
import { broadcastTransaction } from "../services/crypto";
import { createIdempotencyKey } from "../utils/uuid";

export function TransferScreen({ embedded }: { embedded?: boolean } = {}) {
  const { session, reloadSession, activeWalletMode } = useAuth();
  const navigation = useNavigation<any>();
  const mode = embedded ? "crypto" : activeWalletMode;

  // Fiat States
  const [destinationAccountNumber, setDestinationAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  // Crypto States
  const [cryptoToAddress, setCryptoToAddress] = useState("");
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [cryptoLoading, setCryptoLoading] = useState(false);

  const handleFiatTransfer = async () => {
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

  const handleCryptoTransfer = async () => {
    try {
      if (!cryptoToAddress || !cryptoAmount) {
        Alert.alert("Lỗi", "Vui lòng nhập địa chỉ và số lượng ETH.");
        return;
      }
      setCryptoLoading(true);

      const pk = await getPrivateKey();
      if (!pk) {
        Alert.alert("Lỗi", "Không tìm thấy Private Key. Vui lòng tạo ví Web3 bên màn hình Trang chủ.");
        return;
      }

      const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
      const wallet = new ethers.Wallet(pk, provider);

      // 1. Chuẩn bị giao dịch
      const tx = {
        to: cryptoToAddress.trim(),
        value: ethers.parseEther(cryptoAmount.trim()),
      };

      // 2. Ký offline
      const populatedTx = await wallet.populateTransaction(tx);
      const signedTxHex = await wallet.signTransaction(populatedTx);

      // 3. Phát sóng qua Backend (Broadcast)
      const res = await broadcastTransaction(signedTxHex, "eth_sepolia");

      Alert.alert("Phát sóng thành công!", `TxHash: ${res.transactionHash}\nCó thể tốn vài giây để Etherscan xác nhận.`);
      setCryptoToAddress("");
      setCryptoAmount("");
    } catch (e) {
      console.error(e);
      Alert.alert("Lỗi chuyển ETH", (e as Error).message);
    } finally {
      setCryptoLoading(false);
    }
  };

  if (!mode) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-4 py-8">
          <Ionicons name="wallet-outline" size={64} color="#64748b" />
          <Text className="text-xl font-bold text-slate-300">Chưa chọn ví giao dịch</Text>
          <Text className="text-slate-400 text-center px-8">Vui lòng quay lại màn hình Trang chủ để chọn Ví VND hoặc Ví Web3.</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Home")} className="mt-4 bg-slate-800 px-6 py-3 rounded-full">
            <Text className="text-white font-bold">Về Trang Chủ</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  const body = (
    <View className={`gap-4 ${embedded ? "px-4 py-4" : "py-4"}`}>
      {!embedded ? (
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm uppercase tracking-[0.3em] text-emerald-300">Transfer</Text>
            <Text className="mt-2 text-3xl font-black text-white">Chuyển tiền</Text>
          </View>
        </View>
      ) : null}

      {mode === "fiat" && (
          <Card className="gap-4 border border-emerald-500/20">
            <Input label="Số tài khoản nhận (PrimeWallet)" value={destinationAccountNumber} onChangeText={setDestinationAccountNumber} placeholder="PW00001234" />
            <Input label="Số tiền VND" value={amount} onChangeText={setAmount} placeholder="100000" keyboardType="numeric" />
            <Input label="Nội dung" value={description} onChangeText={setDescription} placeholder="Tiền ăn trưa" multiline />
            <Button title="Thực hiện chuyển tiền" onPress={handleFiatTransfer} loading={loading} />
            <Text className="text-sm leading-6 text-slate-400 text-center mt-2">Từ ví: {session?.account?.accountNumber ?? "Chưa tải dữ liệu ví"}</Text>
          </Card>
        )}

        {mode === "crypto" && (
          <Card className="gap-4 border border-violet-500/20">
            <View className="bg-violet-500/10 p-3 rounded-xl border border-violet-500/30 mb-2">
                <Text className="text-violet-300 text-xs text-center">Giao dịch được KÝ OFFLINE và hoàn toàn phi tập trung (Non-Custodial).</Text>
            </View>
            <Input label="Địa chỉ ví nhận (0x...)" value={cryptoToAddress} onChangeText={setCryptoToAddress} placeholder="0x1234..." />
            <Input label="Số lượng ETH" value={cryptoAmount} onChangeText={setCryptoAmount} placeholder="0.01" keyboardType="numeric" />
            <TouchableOpacity onPress={handleCryptoTransfer} disabled={cryptoLoading} className="bg-violet-600 rounded-lg py-4 items-center flex-row justify-center mt-2">
                <Text className="text-white font-bold text-lg">Phát sóng giao dịch (Broadcast)</Text>
            </TouchableOpacity>
          </Card>
        )}
    </View>
  );

  if (embedded) return <ScrollView className="flex-1">{body}</ScrollView>;
  return <Screen>{body}</Screen>;
}
