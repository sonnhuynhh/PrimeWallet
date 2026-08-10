import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { toastErr, toastOk } from "../feedback/toast";
import { shortAddress } from "../../lib/utils";
import { useCrypto } from "../../context/CryptoContext";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ConnectModal({ visible, onClose }: Props) {
  const {
    isWcConnected,
    isWcConnecting,
    externalAddress,
    peerName,
    connectExternal,
    disconnectExternal,
    walletConnectEnabled,
    activeNetwork,
  } = useCrypto();

  const handleConnect = async () => {
    try {
      await connectExternal(activeNetwork?.id);
      toastOk("Đã kết nối ví", peerName ?? "WalletConnect");
      onClose();
    } catch (e) {
      toastErr(e, "Không kết nối được ví");
    }
  };

  return (
    <Modal visible={visible} title="Kết nối ví ngoài" onClose={onClose}>
      {!walletConnectEnabled ? (
        <View className="gap-3">
          <Text className="text-sm text-muted-foreground">
            Thêm <Text className="font-mono text-primary">EXPO_PUBLIC_WC_PROJECT_ID</Text> vào .env (lấy tại
            cloud.walletconnect.com).
          </Text>
          <Button title="Đóng" variant="ghost" onPress={onClose} />
        </View>
      ) : isWcConnected && externalAddress ? (
        <View className="gap-4">
          <View className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <View className="flex-row items-center gap-3">
              <MaterialCommunityIcons name="check-circle" size={28} color="#4ade80" />
              <View className="flex-1">
                <Text className="font-bold text-white">{peerName ?? "WalletConnect"}</Text>
                <Text className="font-mono text-sm text-muted-foreground">{shortAddress(externalAddress, 10, 8)}</Text>
              </View>
            </View>
          </View>
          <Button
            title="Ngắt kết nối"
            variant="ghost"
            onPress={() => {
              void disconnectExternal();
              toastOk("Đã ngắt kết nối ví");
              onClose();
            }}
          />
        </View>
      ) : (
        <View className="gap-3">
          <Pressable
            onPress={() => void handleConnect()}
            disabled={isWcConnecting}
            className="flex-row items-center gap-4 rounded-2xl border border-border bg-white/5 p-4"
          >
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
              {isWcConnecting ? (
                <ActivityIndicator color="#fc72ff" />
              ) : (
                <MaterialCommunityIcons name="qrcode-scan" size={22} color="#fc72ff" />
              )}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="font-bold text-white">WalletConnect</Text>
                <Badge variant="primary">Khuyên dùng</Badge>
              </View>
              <Text className="mt-0.5 text-sm text-muted-foreground">
                Quét QR để kết nối MetaMask, Trust Wallet, OKX…
              </Text>
            </View>
          </Pressable>

          <Text className="pt-2 text-center text-xs text-muted-foreground">
            PrimeWallet không lưu seed phrase — ví ngoài giữ khóa riêng.
          </Text>
        </View>
      )}
    </Modal>
  );
}
