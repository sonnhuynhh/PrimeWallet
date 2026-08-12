import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { ethers } from "ethers";
import { useNavigation } from "@react-navigation/native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Screen } from "../components/ui/Screen";
import { EmptyState } from "../components/ui/EmptyState";
import { ShellProvider } from "../context/ShellContext";
import { useAuth } from "../context/AuthContext";
import { getPrivateKey } from "../storage/secureKeyStore";
import { transfer } from "../services/wallet";
import { broadcastTransaction } from "../services/crypto";
import { createIdempotencyKey } from "../utils/uuid";

export function TransferScreen({ embedded }: { embedded?: boolean } = {}) {
  const { session, reloadSession, activeWalletMode } = useAuth();
  const navigation = useNavigation();
  const mode = embedded ? "crypto" : activeWalletMode;
  const shell = mode === "crypto" ? "crypto" : "fiat";

  const [destinationAccountNumber, setDestinationAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

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
      if (!embedded) navigation.goBack();
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
        Alert.alert("Lỗi", "Không tìm thấy Private Key. Vui lòng tạo ví Web3.");
        return;
      }

      const provider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
      const wallet = new ethers.Wallet(pk, provider);
      const populatedTx = await wallet.populateTransaction({
        to: cryptoToAddress.trim(),
        value: ethers.parseEther(cryptoAmount.trim()),
      });
      const signedTxHex = await wallet.signTransaction(populatedTx);
      const res = await broadcastTransaction(signedTxHex, "eth_sepolia");

      Alert.alert("Phát sóng thành công!", `TxHash: ${res.transactionHash}`);
      setCryptoToAddress("");
      setCryptoAmount("");
    } catch (e) {
      Alert.alert("Lỗi chuyển ETH", (e as Error).message);
    } finally {
      setCryptoLoading(false);
    }
  };

  const body = (
    <View className={`gap-4 ${embedded ? "px-4 py-4" : "py-4"}`}>
      {mode === "fiat" ? (
        <Card className="gap-4">
          <Input
            label="Số tài khoản nhận (PrimeWallet)"
            value={destinationAccountNumber}
            onChangeText={setDestinationAccountNumber}
            placeholder="PW00001234"
          />
          <Input label="Số tiền VND" value={amount} onChangeText={setAmount} placeholder="100000" keyboardType="numeric" />
          <Input label="Nội dung" value={description} onChangeText={setDescription} placeholder="Tiền ăn trưa" multiline />
          <Button title="Thực hiện chuyển tiền" onPress={() => void handleFiatTransfer()} loading={loading} shell="fiat" />
          <Text className="text-center text-sm text-muted-foreground">
            Từ ví: {session?.account?.accountNumber ?? "—"}
          </Text>
        </Card>
      ) : mode === "crypto" ? (
        <Card className="gap-4">
          <Text className="rounded-2xl border border-primary/20 bg-primary/10 p-3 text-center text-xs text-primary">
            Giao dịch ký offline — non-custodial.
          </Text>
          <Input label="Địa chỉ ví nhận (0x...)" value={cryptoToAddress} onChangeText={setCryptoToAddress} placeholder="0x1234..." />
          <Input label="Số lượng ETH" value={cryptoAmount} onChangeText={setCryptoAmount} placeholder="0.01" keyboardType="numeric" />
          <Button title="Phát sóng giao dịch" onPress={() => void handleCryptoTransfer()} loading={cryptoLoading} shell="crypto" />
        </Card>
      ) : (
        <EmptyState
          icon="wallet-outline"
          title="Chưa chọn ví"
          description="Quay lại màn hình chính để chọn ví Fiat hoặc Crypto."
          actionLabel="Đóng"
          onAction={() => navigation.goBack()}
        />
      )}
    </View>
  );

  if (embedded) {
    return (
      <ShellProvider shell="crypto">
        <ScrollView className="flex-1">{body}</ScrollView>
      </ShellProvider>
    );
  }

  return (
    <ShellProvider shell={shell}>
      <Screen title="Chuyển tiền" onClose={() => navigation.goBack()}>
        {body}
      </Screen>
    </ShellProvider>
  );
}
