import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Modal } from "../ui/Modal";
import { networkLabel, normalizeNetworkId } from "../../lib/chains";
import { useCrypto } from "../../context/CryptoContext";
import { toastErr, toastOk } from "../feedback/toast";
import type { NetworkInfo } from "../../services/crypto";
import { shellTheme } from "../../theme/tokens";

export function NetworkSwitcher() {
  const theme = shellTheme.crypto;
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
        className="mx-4 mb-2 flex-row items-center justify-between rounded-2xl border border-border px-4 py-3"
        style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
      >
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: theme.primarySoft }}>
            <MaterialCommunityIcons name="lan-connect" size={16} color={theme.primary} />
          </View>
          <View>
            <Text className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mạng</Text>
            <Text className="font-bold text-white">
              {activeNetwork?.label ?? activeNetwork?.name ?? networkLabel(currentId)}
            </Text>
          </View>
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <MaterialCommunityIcons name="chevron-down" size={20} color="#9b9b9b" />
        )}
      </Pressable>

      <Modal visible={open} title="Chọn mạng" description="5 mạng EVM được hỗ trợ" onClose={() => setOpen(false)}>
        <ScrollView showsVerticalScrollIndicator={false} className="max-h-80">
          {networks.map((net: NetworkInfo) => {
            const selected = normalizeNetworkId(net.id) === currentId;
            return (
              <Pressable
                key={net.id}
                onPress={() => void onSelect(net.id)}
                className="mb-2 flex-row items-center justify-between rounded-2xl border border-border px-4 py-3"
                style={{
                  backgroundColor: selected ? theme.primarySoft : "rgba(255,255,255,0.03)",
                  borderColor: selected ? `${theme.primary}55` : "rgba(255,255,255,0.08)",
                }}
              >
                <Text className="font-semibold text-white">{net.label ?? net.name}</Text>
                {selected ? <MaterialCommunityIcons name="check-circle" size={20} color={theme.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Modal>
    </>
  );
}
