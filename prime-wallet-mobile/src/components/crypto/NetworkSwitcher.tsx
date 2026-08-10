import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { networkLabel, normalizeNetworkId } from "../../lib/chains";
import { useCrypto } from "../../context/CryptoContext";
import { toastErr, toastOk } from "../feedback/toast";
import type { NetworkInfo } from "../../services/crypto";

export function NetworkSwitcher() {
  const { networks, activeWallet, activeNetwork, switchNetwork } = useCrypto();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (!activeWallet || networks.length === 0) return null;

  const currentId = normalizeNetworkId(activeWallet.blockchainNetwork);

  const onSelect = async (networkId: string) => {
    if (networkId === currentId || busy) return;
    setBusy(networkId);
    setOpen(false);
    try {
      await switchNetwork(networkId);
      const net = networks.find((n: NetworkInfo) => normalizeNetworkId(n.id) === normalizeNetworkId(networkId));
      toastOk("Đã đổi mạng", net?.label ?? net?.name ?? networkId);
    } catch (e) {
      toastErr(e, "Không đổi được mạng");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="mx-4 mb-2 flex-row items-center justify-between rounded-2xl border border-border bg-white/5 px-4 py-3"
      >
        <View className="flex-row items-center gap-2">
          <MaterialCommunityIcons name="lan-connect" size={18} color="#fc72ff" />
          <Text className="font-bold text-white">
            {activeNetwork?.label ?? activeNetwork?.name ?? networkLabel(currentId)}
          </Text>
        </View>
        {busy ? (
          <ActivityIndicator size="small" color="#fc72ff" />
        ) : (
          <MaterialCommunityIcons name="chevron-down" size={20} color="#9b9b9b" />
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/70" onPress={() => setOpen(false)} />
        <View className="absolute bottom-0 left-0 right-0 rounded-t-3xl border border-border bg-surface-1 p-4">
          <Text className="mb-3 text-lg font-extrabold text-white">Chọn mạng</Text>
          <ScrollView className="max-h-80">
            {networks.map((net: NetworkInfo) => {
              const selected = normalizeNetworkId(net.id) === currentId;
              return (
                <Pressable
                  key={net.id}
                  onPress={() => void onSelect(net.id)}
                  className="mb-2 flex-row items-center justify-between rounded-2xl border border-border px-4 py-3"
                  style={{ backgroundColor: selected ? "rgba(252,114,255,0.12)" : "transparent" }}
                >
                  <Text className="font-semibold text-white">{net.label ?? net.name}</Text>
                  {selected ? <MaterialCommunityIcons name="check" size={18} color="#fc72ff" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
