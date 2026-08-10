import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, Text, View } from "react-native";
import { ethers } from "ethers";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { toastErr } from "../../feedback/toast";
import { shortAddress } from "../../../lib/utils";
import { txExplorerUrl } from "../../../lib/chains";
import { useCrypto } from "../../../context/CryptoContext";
import { getWalletHistory, getInAppTransactions } from "../../../services/crypto";
import type { EtherscanTransaction } from "../../../services/crypto";
import type { InAppTransaction } from "../../../types/crypto";

type Mode = "onchain" | "inapp";

export function HistoryTab() {
  const { activeWallet } = useCrypto();
  const [mode, setMode] = useState<Mode>("onchain");
  const [onchain, setOnchain] = useState<EtherscanTransaction[]>([]);
  const [inApp, setInApp] = useState<InAppTransaction[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeWallet) return;
    setLoading(true);
    try {
      if (mode === "onchain") {
        const res = await getWalletHistory(activeWallet.id);
        setOnchain(Array.isArray(res.result) ? res.result : []);
      } else {
        const page = await getInAppTransactions(activeWallet.id);
        setInApp(page.content ?? []);
      }
    } catch (e) {
      toastErr(e, "Không tải được lịch sử");
    } finally {
      setLoading(false);
    }
  }, [activeWallet, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!activeWallet) {
    return (
      <Card className="mx-4 my-4">
        <Text className="text-center text-muted-foreground">Liên kết ví để xem lịch sử.</Text>
      </Card>
    );
  }

  return (
    <View className="flex-1 px-4 py-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-extrabold text-white">Lịch sử</Text>
        <Button title="Làm mới" variant="ghost" onPress={() => void load()} />
      </View>

      <View className="mb-3 flex-row gap-2">
        <Pressable
          onPress={() => setMode("onchain")}
          className="flex-1 items-center rounded-full py-2"
          style={{ backgroundColor: mode === "onchain" ? "rgba(252,114,255,0.15)" : "rgba(255,255,255,0.05)" }}
        >
          <Text className="text-xs font-bold text-white">On-chain</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("inapp")}
          className="flex-1 items-center rounded-full py-2"
          style={{ backgroundColor: mode === "inapp" ? "rgba(252,114,255,0.15)" : "rgba(255,255,255,0.05)" }}
        >
          <Text className="text-xs font-bold text-white">In-app</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color="#fc72ff" /> : null}

      {mode === "onchain" ? (
        <FlatList
          data={onchain}
          keyExtractor={(item) => item.hash}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => {
            const ethValue = ethers.formatEther(item.value);
            const date = new Date(parseInt(item.timeStamp, 10) * 1000).toLocaleString("vi-VN");
            return (
              <Pressable onPress={() => Linking.openURL(txExplorerUrl(activeWallet.blockchainNetwork, item.hash))}>
                <Card className="gap-1">
                  <View className="flex-row justify-between">
                    <Text className="font-bold text-white">Transfer</Text>
                    <MaterialCommunityIcons name="open-in-new" size={14} color="#9b9b9b" />
                  </View>
                  <Text className="text-xs text-muted-foreground">{date}</Text>
                  <Text className="font-mono text-xs text-muted-foreground">{shortAddress(item.hash, 10, 8)}</Text>
                  <Text className="font-extrabold text-primary">{ethValue} ETH</Text>
                </Card>
              </Pressable>
            );
          }}
          ListEmptyComponent={!loading ? <Text className="text-muted-foreground">Chưa có giao dịch on-chain.</Text> : null}
        />
      ) : (
        <FlatList
          data={inApp}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <Card className="gap-1">
              <View className="flex-row items-center justify-between">
                <Text className="font-bold text-white">{item.type}</Text>
                <Badge variant={item.status === "SUCCESS" ? "success" : "warning"}>{item.status}</Badge>
              </View>
              <Text className="text-sm text-primary">
                {item.amount} {item.symbol}
              </Text>
              <Text className="text-xs text-muted-foreground">
                → {shortAddress(item.toAddress)}
              </Text>
            </Card>
          )}
          ListEmptyComponent={!loading ? <Text className="text-muted-foreground">Chưa có giao dịch in-app.</Text> : null}
        />
      )}
    </View>
  );
}
