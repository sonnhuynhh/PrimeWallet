import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Text, TouchableOpacity, View } from "react-native";
import { ethers } from "ethers";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { toastErr } from "../components/feedback/toast";
import { useAuth } from "../context/AuthContext";
import { getTransactionHistory } from "../services/wallet";
import { getLinkedWallets, getWalletHistory, type EtherscanTransaction } from "../services/crypto";
import { fmtVnd } from "../lib/utils";
import { nativeSymbolOf, txExplorerUrl } from "../lib/chains";
import { fetchOnChainTransactions, normalizeEtherscanResult } from "../lib/onchain/history";
import { ETHERSCAN_API_KEY } from "../config/env";
import type { TransactionResponse } from "../types/api";

function safeFormatEther(value: string | undefined): string {
  try {
    if (!value) return "0";
    return ethers.formatEther(value);
  } catch {
    return "0";
  }
}

export function HistoryScreen({ embedded }: { embedded?: boolean } = {}) {
  const { session } = useAuth();
  // Fiat shell không truyền embedded → luôn fiat
  const mode = embedded ? "crypto" : "fiat";

  const [fiatItems, setFiatItems] = useState<TransactionResponse[]>([]);
  const [fiatLoading, setFiatLoading] = useState(true);
  const [cryptoItems, setCryptoItems] = useState<EtherscanTransaction[]>([]);
  const [cryptoLoading, setCryptoLoading] = useState(true);
  const [network, setNetwork] = useState("eth_sepolia");

  useEffect(() => {
    if (mode === "fiat") void loadFiatHistory();
    if (mode === "crypto") void loadCryptoHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (e) {
      toastErr(e, "Không tải được lịch sử fiat");
      setFiatItems([]);
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
        let rows = normalizeEtherscanResult(response.result);
        if (rows.length === 0) {
          const fallback = await fetchOnChainTransactions(
            wallet.blockchainNetwork,
            wallet.walletAddress,
            ETHERSCAN_API_KEY || undefined,
          );
          if (fallback.length > 0) rows = fallback;
        }
        setCryptoItems(rows);
      }
    } catch (e) {
      toastErr(e, "Không tải được lịch sử crypto");
      setCryptoItems([]);
    } finally {
      setCryptoLoading(false);
    }
  };

  if (mode === "fiat") {
    if (fiatLoading) return <ActivityIndicator color="#21c95e" className="mt-8" />;
    return (
      <FlatList
        data={fiatItems}
        keyExtractor={(item) => item.id}
        className="flex-1 px-4 py-4"
        scrollEnabled={!embedded}
        contentContainerStyle={{ gap: 10, paddingBottom: 24, flexGrow: 1 }}
        renderItem={({ item }) => (
          <Card className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-bold text-white">{item.transactionType}</Text>
              <Badge variant={item.status === "SUCCESS" ? "success" : item.status === "FAILED" ? "danger" : "warning"}>
                {item.status}
              </Badge>
            </View>
            <Text className="text-xs text-muted-foreground">{item.referenceNumber}</Text>
            <Text
              className={`font-extrabold ${
                item.transactionType === "TOPUP"
                  ? "text-success"
                  : item.transactionType === "WITHDRAW"
                    ? "text-destructive"
                    : "text-white"
              }`}
            >
              {item.transactionType === "TOPUP" ? "+" : item.transactionType === "WITHDRAW" ? "-" : ""}
              {fmtVnd(item.amount)}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState icon="history" title="Chưa có giao dịch" description="Lịch sử chuyển tiền và nạp rút sẽ hiện ở đây." />
        }
      />
    );
  }

  if (cryptoLoading) return <ActivityIndicator color="#fc72ff" className="mt-8" />;

  return (
    <FlatList
      data={cryptoItems}
      keyExtractor={(item) => item.hash}
      className="flex-1 px-4 py-4"
      scrollEnabled={!embedded}
      contentContainerStyle={{ gap: 10, paddingBottom: 24, flexGrow: 1 }}
      renderItem={({ item }) => {
        const ethValue = safeFormatEther(item.value);
        const sym = nativeSymbolOf(network);
        const date = new Date(parseInt(item.timeStamp, 10) * 1000).toLocaleString("vi-VN");
        return (
          <TouchableOpacity onPress={() => Linking.openURL(txExplorerUrl(network, item.hash))}>
            <Card className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text className="font-bold text-white">Chuyển {sym}</Text>
                <MaterialCommunityIcons name="open-in-new" size={16} color="#9b9b9b" />
              </View>
              <Text className="text-xs text-muted-foreground">{date}</Text>
              <Text className="font-extrabold text-primary">
                {ethValue} {sym}
              </Text>
            </Card>
          </TouchableOpacity>
        );
      }}
      ListEmptyComponent={
        <EmptyState icon="history" title="Chưa có giao dịch" description="Giao dịch on-chain sẽ hiện ở đây." />
      }
    />
  );
}
