import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, Text, View } from "react-native";
import { ethers } from "ethers";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Card } from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { EmptyState } from "../../ui/EmptyState";
import { SegmentToggle } from "../SegmentToggle";
import { toastErr } from "../../feedback/toast";
import { shortAddress } from "../../../lib/utils";
import { nativeSymbolOf, txExplorerUrl } from "../../../lib/chains";
import { fetchOnChainTransactions, normalizeEtherscanResult } from "../../../lib/onchain/history";
import { ETHERSCAN_API_KEY } from "../../../config/env";
import { useCrypto } from "../../../context/CryptoContext";
import { getWalletHistory, getInAppTransactions } from "../../../services/crypto";
import type { EtherscanTransaction } from "../../../services/crypto";
import type { InAppTransaction } from "../../../types/crypto";
import { shellTheme } from "../../../theme/tokens";

type Mode = "onchain" | "inapp";

const MODES = [
  { id: "onchain" as const, label: "On-chain" },
  { id: "inapp" as const, label: "In-app" },
];

export function HistoryTab() {
  const theme = shellTheme.crypto;
  const { activeWallet, activeNetwork } = useCrypto();
  const [mode, setMode] = useState<Mode>("onchain");
  const [onchain, setOnchain] = useState<EtherscanTransaction[]>([]);
  const [inApp, setInApp] = useState<InAppTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const nativeSymbol =
    activeNetwork?.nativeSymbol ?? nativeSymbolOf(activeWallet?.blockchainNetwork ?? "eth_sepolia");

  const load = useCallback(async () => {
    if (!activeWallet) return;
    setLoading(true);
    setHint(null);
    try {
      if (mode === "onchain") {
        const res = await getWalletHistory(activeWallet.id);
        let rows = normalizeEtherscanResult(res.result);

        if (rows.length === 0) {
          const fallback = await fetchOnChainTransactions(
            activeWallet.blockchainNetwork,
            activeWallet.walletAddress,
            ETHERSCAN_API_KEY || undefined,
          );
          if (fallback.length > 0) {
            rows = fallback;
          } else if (!ETHERSCAN_API_KEY) {
            setHint("Thêm EXPO_PUBLIC_ETHERSCAN_API_KEY vào .env để fallback lịch sử on-chain.");
          }
        }

        setOnchain(rows);
      } else {
        const page = await getInAppTransactions(activeWallet.id, 0, 50);
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
      <View className="flex-1 px-4 py-8">
        <EmptyState icon="history" title="Chưa có ví" description="Liên kết ví để xem lịch sử giao dịch." />
      </View>
    );
  }

  const header = (
    <View className="mb-4 gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-extrabold text-white">Lịch sử</Text>
        <Pressable onPress={() => void load()} hitSlop={8} className="rounded-full bg-white/5 p-2">
          <MaterialCommunityIcons name="refresh" size={18} color={theme.primary} />
        </Pressable>
      </View>
      <SegmentToggle options={MODES} value={mode} onChange={setMode} />
      {loading ? <ActivityIndicator color={theme.primary} /> : null}
      {hint ? (
        <Text className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
          {hint}
        </Text>
      ) : null}
    </View>
  );

  if (mode === "onchain") {
    return (
      <FlatList
        style={{ flex: 1 }}
        className="px-4"
        data={onchain}
        keyExtractor={(item) => item.hash}
        contentContainerStyle={{ gap: 10, paddingBottom: 24, flexGrow: 1 }}
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const value = ethers.formatEther(item.value);
          const date = new Date(parseInt(item.timeStamp, 10) * 1000).toLocaleString("vi-VN");
          const failed = item.isError === "1";
          return (
            <Pressable onPress={() => Linking.openURL(txExplorerUrl(activeWallet.blockchainNetwork, item.hash))}>
              <Card className="gap-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View
                      className="h-8 w-8 items-center justify-center rounded-xl"
                      style={{ backgroundColor: theme.primarySoft }}
                    >
                      <MaterialCommunityIcons name="arrow-top-right" size={16} color={theme.primary} />
                    </View>
                    <Text className="font-bold text-white">Transfer</Text>
                  </View>
                  <Badge variant={failed ? "danger" : "success"}>{failed ? "Failed" : "OK"}</Badge>
                </View>
                <Text className="text-xs text-muted-foreground">{date}</Text>
                <Text className="font-mono text-xs text-muted-foreground">{shortAddress(item.hash, 10, 8)}</Text>
                <Text className="font-extrabold" style={{ color: theme.primary }}>
                  {value} {nativeSymbol}
                </Text>
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="history" title="Chưa có giao dịch" description="Giao dịch on-chain sẽ hiện ở đây." />
          ) : null
        }
      />
    );
  }

  return (
    <FlatList
      style={{ flex: 1 }}
      className="px-4"
      data={inApp}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ gap: 10, paddingBottom: 24, flexGrow: 1 }}
      ListHeaderComponent={header}
      renderItem={({ item }) => (
        <Card className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text className="font-bold text-white">{item.type}</Text>
            <Badge variant={item.status === "SUCCESS" ? "success" : "warning"}>{item.status}</Badge>
          </View>
          <Text className="text-sm font-extrabold" style={{ color: theme.primary }}>
            {item.amount} {item.symbol}
          </Text>
          <Text className="text-xs text-muted-foreground">→ {shortAddress(item.toAddress)}</Text>
        </Card>
      )}
      ListEmptyComponent={
        !loading ? (
          <EmptyState icon="history" title="Chưa có giao dịch" description="Giao dịch in-app sẽ hiện ở đây." />
        ) : null
      }
    />
  );
}
