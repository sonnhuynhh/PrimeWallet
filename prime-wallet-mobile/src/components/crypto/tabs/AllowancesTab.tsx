import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { ethers } from "ethers";

import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { toastErr, toastOk } from "../../feedback/toast";
import { useCrypto } from "../../../context/CryptoContext";
import { scanAllowances, buildRevokeCalldata, type AllowanceEntry } from "../../../lib/allowance/scan";
import { ETHERSCAN_API_KEY } from "../../../config/env";

export function AllowancesTab() {
  const { activeWallet, signAndSend } = useCrypto();
  const [entries, setEntries] = useState<AllowanceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = async () => {
    if (!activeWallet) return;
    setLoading(true);
    try {
      const result = await scanAllowances({
        networkId: activeWallet.blockchainNetwork,
        owner: activeWallet.walletAddress,
        etherscanApiKey: ETHERSCAN_API_KEY || undefined,
      });
      setEntries(result.entries);
    } catch (e) {
      toastErr(e, "Không quét được allowances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [activeWallet?.id]);

  const revoke = async (entry: AllowanceEntry) => {
    setRevoking(`${entry.token}:${entry.spender}`);
    try {
      const hash = await signAndSend({
        to: entry.token,
        data: buildRevokeCalldata(entry.spender),
        value: 0n,
      });
      toastOk("Đã thu hồi quyền", hash.slice(0, 10) + "…");
      await load();
    } catch (e) {
      toastErr(e, "Thu hồi thất bại");
    } finally {
      setRevoking(null);
    }
  };

  if (!activeWallet) {
    return (
      <Card className="mx-4 my-4">
        <Text className="text-center text-muted-foreground">Liên kết ví để quét allowances.</Text>
      </Card>
    );
  }

  return (
    <View className="flex-1 px-4 py-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-extrabold text-white">Token Allowances</Text>
        <Button title="Quét lại" variant="ghost" onPress={() => void load()} />
      </View>

      {loading ? <ActivityIndicator color="#fc72ff" /> : null}

      <FlatList
        data={entries}
        keyExtractor={(e) => `${e.token}:${e.spender}`}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-bold text-white">{item.tokenSymbol}</Text>
              {item.isUnlimited ? <Badge variant="warning">Unlimited</Badge> : null}
            </View>
            <Text className="text-xs text-muted-foreground">
              Spender: {item.spenderName ?? item.spender.slice(0, 12) + "…"}
            </Text>
            <Text className="text-sm text-white">
              {item.isUnlimited ? "∞" : ethers.formatUnits(item.amount, item.tokenDecimals)}
            </Text>
            <Button
              title="Thu hồi (approve 0)"
              variant="ghost"
              loading={revoking === `${item.token}:${item.spender}`}
              onPress={() => void revoke(item)}
            />
          </Card>
        )}
        ListEmptyComponent={
          !loading ? <Text className="text-muted-foreground">Không có allowance đang mở.</Text> : null
        }
      />
    </View>
  );
}
