import { useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";

import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { shortAddress, fmtNumber } from "../../../lib/utils";
import { networkLabel } from "../../../lib/chains";
import { useCrypto } from "../../../context/CryptoContext";
import { unlinkCryptoWallet } from "../../../services/crypto";
import { toastErr, toastOk } from "../../feedback/toast";
import { ConnectModal } from "../../wallet/ConnectModal";
import { Badge } from "../../ui/Badge";

export function WalletTab() {
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
        data={wallets}
        keyExtractor={(w) => w.id}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        ListHeaderComponent={
          <>
            <Button title="Kết nối ví ngoài (WalletConnect)" onPress={() => setShowConnect(true)} />
            {isWcConnected ? (
              <Card className="mb-2 mt-3 gap-1 border border-emerald-500/30">
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs font-bold text-emerald-400">WalletConnect</Text>
                  {usesWalletClient ? <Badge variant="success">Đang ký</Badge> : null}
                </View>
                <Text className="text-sm text-white">{peerName ?? "Ví ngoài"}</Text>
              </Card>
            ) : null}
            {activeWallet ? (
            <Card className="mb-2 gap-2 border border-primary/30">
              <Text className="text-xs font-bold uppercase text-primary">Ví đang dùng</Text>
              <Text className="font-mono text-white">{activeWallet.walletAddress}</Text>
              <Text className="text-sm text-muted-foreground">
                {networkLabel(activeWallet.blockchainNetwork)} · {fmtNumber(balance?.balanceEth ?? 0)} ETH
              </Text>
            </Card>
            ) : null}
          </>
        }
        renderItem={({ item }) => {
          const selected = item.id === activeWallet?.id;
          return (
            <Pressable onPress={() => void selectWallet(item)}>
              <Card
                className="gap-2"
                style={{
                  borderColor: selected ? "rgba(252,114,255,0.4)" : "rgba(255,255,255,0.08)",
                }}
              >
                <Text className="font-bold text-white">{item.label ?? shortAddress(item.walletAddress)}</Text>
                <Text className="text-xs text-muted-foreground">{networkLabel(item.blockchainNetwork)}</Text>
                <Text className="font-mono text-sm text-white">{shortAddress(item.walletAddress, 8, 6)}</Text>
                <Button title="Gỡ liên kết" variant="ghost" onPress={() => unlink(item.id)} />
              </Card>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Card>
            <Text className="text-muted-foreground">Chưa có ví — tạo tại tab Tài sản.</Text>
          </Card>
        }
      />
    </View>
  );
}
