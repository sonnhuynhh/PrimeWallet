import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Text, TouchableOpacity, View } from "react-native";
import { ethers } from "ethers";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Screen } from "../components/ui/Screen";
import { useAuth } from "../context/AuthContext";
import { getTransactionHistory } from "../services/wallet";
import { getLinkedWallets, getWalletHistory, type EtherscanTransaction } from "../services/crypto";
import { fmtNumber, fmtVnd } from "../lib/utils";
import { txExplorerUrl } from "../lib/chains";
import type { TransactionResponse } from "../types/api";

export function HistoryScreen({ embedded }: { embedded?: boolean } = {}) {
  const { session, activeWalletMode } = useAuth();
  const navigation = useNavigation<any>();
  const mode = embedded ? "crypto" : activeWalletMode;

  const [fiatItems, setFiatItems] = useState<TransactionResponse[]>([]);
  const [fiatLoading, setFiatLoading] = useState(true);
  const [cryptoItems, setCryptoItems] = useState<EtherscanTransaction[]>([]);
  const [cryptoLoading, setCryptoLoading] = useState(true);
  const [network, setNetwork] = useState("eth_sepolia");

  useEffect(() => {
    if (mode === "fiat") void loadFiatHistory();
    if (mode === "crypto") void loadCryptoHistory();
  }, [mode, session?.account?.id]);

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
    } finally {
      setFiatLoading(false);
    }
  };

  const loadCryptoHistory = async () => {
    setCryptoLoading(true);
    try {
      const wallets = await getLinkedWallets();
      const wallet = wallets[0];
      if (wallet) {
        setNetwork(wallet.blockchainNetwork.toLowerCase());
        const response = await getWalletHistory(wallet.id);
        setCryptoItems(Array.isArray(response.result) ? response.result : []);
      }
    } finally {
      setCryptoLoading(false);
    }
  };

  if (!mode) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-muted-foreground">Chưa chọn loại ví.</Text>
        </View>
      </Screen>
    );
  }

  const content = (
    <View className={`flex-1 gap-4 ${embedded ? "px-4 py-4" : "py-4"}`}>
      {!embedded ? (
        <Text className="text-2xl font-extrabold text-white">Lịch sử giao dịch</Text>
      ) : null}

      {mode === "fiat" ? (
        fiatLoading ? (
          <ActivityIndicator color="#21c95e" />
        ) : (
          <FlatList
            data={fiatItems}
            keyExtractor={(item) => item.id}
            scrollEnabled={!embedded}
            contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
            renderItem={({ item }) => (
              <Card className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className="font-bold text-white">{item.transactionType}</Text>
                  <Badge variant={item.status === "SUCCESS" ? "success" : item.status === "FAILED" ? "danger" : "warning"}>{item.status}</Badge>
                </View>
                <Text className="text-xs text-muted-foreground">{item.referenceNumber}</Text>
                <Text className={`font-extrabold ${item.transactionType === "TOPUP" ? "text-emerald-400" : item.transactionType === "WITHDRAW" ? "text-rose-400" : "text-white"}`}>
                  {item.transactionType === "TOPUP" ? "+" : item.transactionType === "WITHDRAW" ? "-" : ""}
                  {fmtVnd(item.amount)}
                </Text>
              </Card>
            )}
            ListEmptyComponent={<Text className="text-muted-foreground">Chưa có giao dịch.</Text>}
          />
        )
      ) : cryptoLoading ? (
        <ActivityIndicator color="#fc72ff" />
      ) : (
        <FlatList
          data={cryptoItems}
          keyExtractor={(item) => item.hash}
          scrollEnabled={!embedded}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const ethValue = ethers.formatEther(item.value);
            const date = new Date(parseInt(item.timeStamp, 10) * 1000).toLocaleString("vi-VN");
            return (
              <TouchableOpacity onPress={() => Linking.openURL(txExplorerUrl(network, item.hash))}>
                <Card className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-bold text-white">Chuyển ETH</Text>
                    <MaterialCommunityIcons name="open-in-new" size={16} color="#9b9b9b" />
                  </View>
                  <Text className="text-xs text-muted-foreground">{date}</Text>
                  <Text className="font-extrabold text-primary">{ethValue} ETH</Text>
                </Card>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text className="text-muted-foreground">Chưa có giao dịch on-chain.</Text>}
        />
      )}
    </View>
  );

  if (embedded) return content;
  return <Screen>{content}</Screen>;
}
