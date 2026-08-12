import { useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Card, CardHeader } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { Badge } from "../../ui/Badge";
import { EmptyState } from "../../ui/EmptyState";
import { shortAddress, fmtNumber } from "../../../lib/utils";
import { networkLabel } from "../../../lib/chains";
import { useCrypto } from "../../../context/CryptoContext";
import { unlinkCryptoWallet } from "../../../services/crypto";
import { toastErr, toastOk } from "../../feedback/toast";
import { ConnectModal } from "../../wallet/ConnectModal";
import { shellTheme } from "../../../theme/tokens";

export function WalletTab() {
  const theme = shellTheme.crypto;
  const { wallets, activeWallet, balance, selectWallet, reload, isWcConnected, peerName, usesWalletClient } =
    useCrypto();
  const [showConnect, setShowConnect] = useState(false);

  const unlink = (id: string) => {
    Alert.alert("Gỡ liên kết ví?", "Ví vẫn tồn tại on-chain — chỉ xóa khỏi tài khoản PrimeWallet.", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Gỡ",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await unlinkCryptoWallet(id);
              toastOk("Đã gỡ ví");
              await reload();
            } catch (e) {
              toastErr(e, "Không gỡ được ví");
            }
          })();
        },
      },
    ]);
  };

  return (
    <View className="flex-1 px-4 py-4">
      <ConnectModal visible={showConnect} onClose={() => setShowConnect(false)} />
      <FlatList
        style={{ flex: 1 }}
        data={wallets}
        keyExtractor={(w) => w.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 24, flexGrow: 1 }}
        ListHeaderComponent={
          <View className="gap-3">
            <CardHeader
              title="Quản lý ví"
              description="Ví nội bộ & WalletConnect"
              icon={<MaterialCommunityIcons name="wallet-outline" size={20} color={theme.primary} />}
            />
            <Button title="Kết nối ví ngoài (WalletConnect)" onPress={() => setShowConnect(true)} />
            {isWcConnected ? (
              <Card className="gap-2" style={{ borderColor: `${theme.primary}44` }}>
                <View className="flex-row items-center gap-2">
                  <MaterialCommunityIcons name="link-variant" size={16} color={theme.primary} />
                  <Text className="text-xs font-bold" style={{ color: theme.primary }}>
                    WalletConnect
                  </Text>
                  {usesWalletClient ? <Badge variant="success">Đang ký</Badge> : null}
                </View>
                <Text className="text-sm font-semibold text-white">{peerName ?? "Ví ngoài"}</Text>
              </Card>
            ) : null}
            {activeWallet ? (
              <Card className="gap-2" style={{ backgroundColor: theme.primarySoft, borderColor: `${theme.primary}44` }}>
                <Text className="text-xs font-bold uppercase tracking-widest" style={{ color: theme.primary }}>
                  Ví đang dùng
                </Text>
                <Text className="font-mono text-sm text-white">{activeWallet.walletAddress}</Text>
                <Text className="text-sm text-muted-foreground">
                  {networkLabel(activeWallet.blockchainNetwork)} · {fmtNumber(balance?.balanceEth ?? 0)} ETH
                </Text>
              </Card>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const selected = item.id === activeWallet?.id;
          return (
            <Pressable onPress={() => void selectWallet(item)}>
              <Card
                className="gap-2"
                style={{
                  borderColor: selected ? `${theme.primary}66` : "rgba(255,255,255,0.08)",
                  backgroundColor: selected ? `${theme.primarySoft}` : undefined,
                }}
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-bold text-white">{item.label ?? shortAddress(item.walletAddress)}</Text>
                  {selected ? <Badge variant="primary">Active</Badge> : null}
                </View>
                <Text className="text-xs text-muted-foreground">{networkLabel(item.blockchainNetwork)}</Text>
                <Text className="font-mono text-sm text-white">{shortAddress(item.walletAddress, 8, 6)}</Text>
                <Button title="Gỡ liên kết" variant="ghost" onPress={() => unlink(item.id)} />
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState icon="wallet-outline" title="Chưa có ví" description="Tạo ví tại tab Tài sản." />
        }
      />
    </View>
  );
}
