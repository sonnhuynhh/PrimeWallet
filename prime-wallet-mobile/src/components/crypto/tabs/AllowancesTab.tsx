import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { ethers } from "ethers";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Card, CardHeader } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { EmptyState } from "../../ui/EmptyState";
import { toastErr, toastOk } from "../../feedback/toast";
import { useCrypto } from "../../../context/CryptoContext";
import { scanAllowances, buildRevokeCalldata, type AllowanceEntry } from "../../../lib/allowance/scan";
import { ETHERSCAN_API_KEY } from "../../../config/env";
import { shellTheme } from "../../../theme/tokens";

export function AllowancesTab() {
  const theme = shellTheme.crypto;
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
      <View className="flex-1 px-4 py-8">
        <EmptyState icon="shield-check" title="Chưa có ví" description="Liên kết ví để quét token allowances." />
      </View>
    );
  }

  return (
    <View className="flex-1 px-4 py-4">
      <View className="mb-4 flex-row items-center justify-between">
        <CardHeader
          title="Token Allowances"
          description="Quyền chi tiêu đã cấp cho DApp"
          icon={<MaterialCommunityIcons name="shield-check" size={20} color={theme.primary} />}
        />
        <Pressable onPress={() => void load()} hitSlop={8} className="rounded-full bg-white/5 p-2">
          <MaterialCommunityIcons name="refresh" size={18} color={theme.primary} />
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={theme.primary} className="mb-4" /> : null}

      <FlatList
        style={{ flex: 1 }}
        data={entries}
        keyExtractor={(e) => `${e.token}:${e.spender}`}
        contentContainerStyle={{ gap: 10, paddingBottom: 24, flexGrow: 1 }}
        renderItem={({ item }) => (
          <Card className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="font-bold text-white">{item.tokenSymbol}</Text>
              {item.isUnlimited ? <Badge variant="warning">Unlimited</Badge> : null}
            </View>
            <Text className="text-xs text-muted-foreground">
              Spender: {item.spenderName ?? item.spender.slice(0, 12) + "…"}
            </Text>
            <Text className="text-sm font-semibold text-white">
              {item.isUnlimited ? "∞" : ethers.formatUnits(item.amount, item.tokenDecimals)}
            </Text>
            <Button
              title="Thu hồi (approve 0)"
              variant="outline"
              loading={revoking === `${item.token}:${item.spender}`}
              onPress={() => void revoke(item)}
            />
          </Card>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="shield-check" title="Không có allowance" description="Không tìm thấy quyền chi tiêu đang mở." />
          ) : null
        }
      />
    </View>
  );
}
