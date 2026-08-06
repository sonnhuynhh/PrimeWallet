import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View, Linking, TouchableOpacity } from "react-native";
import { ethers } from "ethers";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { Card } from "../components/ui/Card";
import { Screen } from "../components/ui/Screen";
import { useAuth } from "../context/AuthContext";
import { getTransactionHistory } from "../services/wallet";
import { getLinkedWallets, getWalletHistory, EtherscanTransaction } from "../services/crypto";
import type { TransactionResponse } from "../types/api";

export function HistoryScreen() {
  const { session, activeWalletMode } = useAuth();
  const navigation = useNavigation<any>();
  
  // Fiat States
  const [fiatItems, setFiatItems] = useState<TransactionResponse[]>([]);
  const [fiatLoading, setFiatLoading] = useState(true);

  // Crypto States
  const [cryptoItems, setCryptoItems] = useState<EtherscanTransaction[]>([]);
  const [cryptoLoading, setCryptoLoading] = useState(true);

  useEffect(() => {
    if (activeWalletMode === "fiat") {
      loadFiatHistory();
    } else if (activeWalletMode === "crypto") {
      loadCryptoHistory();
    }
  }, [activeWalletMode, session?.account?.id]);

  const loadFiatHistory = async () => {
    const accountId = session?.account?.id;
    if (!accountId) {
      setFiatLoading(false);
      return;
    }
    setFiatLoading(true);
    try {
      const page = await getTransactionHistory(accountId);
      setFiatItems(page.content);
    } catch (e) {
      console.error(e);
    } finally {
      setFiatLoading(false);
    }
  };

  const loadCryptoHistory = async () => {
    setCryptoLoading(true);
    try {
      const wallets = await getLinkedWallets();
      const sepoliaWallet = wallets.find((w) => w.blockchainNetwork === "ETH_SEPOLIA");
      if (sepoliaWallet) {
        const response = await getWalletHistory(sepoliaWallet.id);
        if (response.status === "1" && Array.isArray(response.result)) {
          setCryptoItems(response.result);
        } else {
          setCryptoItems([]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCryptoLoading(false);
    }
  };

  if (!activeWalletMode) {
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

  return (
    <Screen>
      <View className="flex-1 gap-4 py-4">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm uppercase tracking-[0.3em] text-emerald-300">History</Text>
            <Text className="mt-2 text-3xl font-black text-white">Lịch sử giao dịch</Text>
          </View>
        </View>

        {activeWalletMode === "fiat" ? (
          fiatLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#34d399" />
            </View>
          ) : (
            <FlatList
              data={fiatItems}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
              renderItem={({ item }) => (
                <Card className="gap-2 border border-emerald-500/20">
                  <Text className="text-base font-semibold text-white">{item.transactionType}</Text>
                  <Text className="text-sm text-slate-300">{item.referenceNumber}</Text>
                  <Text className="text-sm text-slate-300">{item.description ?? "Không có mô tả"}</Text>
                  <Text className="text-sm text-emerald-300">{Number(item.amount).toLocaleString("vi-VN")} {item.currency}</Text>
                </Card>
              )}
              ListEmptyComponent={<Card><Text className="text-slate-300">Chưa có giao dịch nội bộ nào.</Text></Card>}
            />
          )
        ) : (
          cryptoLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#8b5cf6" />
            </View>
          ) : (
            <FlatList
              data={cryptoItems}
              keyExtractor={(item) => item.hash}
              contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
              renderItem={({ item }) => {
                const ethValue = ethers.formatEther(item.value);
                const date = new Date(parseInt(item.timeStamp) * 1000).toLocaleString("vi-VN");
                return (
                  <TouchableOpacity onPress={() => Linking.openURL(`https://sepolia.etherscan.io/tx/${item.hash}`)}>
                    <Card className="gap-2 border border-violet-500/20">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-base font-semibold text-white">Chuyển ETH</Text>
                        <Text className="text-xs text-slate-400">{date}</Text>
                      </View>
                      <Text className="text-xs text-slate-400" numberOfLines={1} ellipsizeMode="middle">TxHash: {item.hash}</Text>
                      <View className="flex-row items-center justify-between mt-1">
                        <Text className={`text-sm ${item.isError === "1" ? "text-red-400" : "text-emerald-400"}`}>
                          {item.isError === "1" ? "Thất bại" : "Thành công"}
                        </Text>
                        <Text className="text-lg font-black text-violet-300">{ethValue} ETH</Text>
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Card><Text className="text-slate-300">Chưa có giao dịch On-chain nào (Etherscan).</Text></Card>}
            />
          )
        )}
      </View>
    </Screen>
  );
}
