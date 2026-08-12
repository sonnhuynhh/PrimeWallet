import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { WalletLayout } from "../components/layout/WalletLayout";
import { BottomTabBar, type BottomTabItem } from "../components/ui/BottomTabBar";
import { Modal } from "../components/ui/Modal";
import { NetworkSwitcher } from "../components/crypto/NetworkSwitcher";
import { AssetsTab } from "../components/crypto/tabs/AssetsTab";
import { SendTab } from "../components/crypto/tabs/SendTab";
import { HistoryTab } from "../components/crypto/tabs/HistoryTab";
import { BridgeTab } from "../components/crypto/tabs/BridgeTab";
import { ReceiveTab } from "../components/crypto/tabs/ReceiveTab";
import { WalletTab } from "../components/crypto/tabs/WalletTab";
import { SwapTab } from "../components/crypto/tabs/SwapTab";
import { NftTab } from "../components/crypto/tabs/NftTab";
import { AllowancesTab } from "../components/crypto/tabs/AllowancesTab";
import { CryptoProvider } from "../context/CryptoContext";
import { ShellProvider } from "../context/ShellContext";
import { useAuth } from "../context/AuthContext";
import { shellTheme } from "../theme/tokens";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Crypto">;

type BottomTab = "assets" | "swap" | "send" | "receive" | "more";
type CryptoTab = BottomTab | "bridge" | "history" | "nft" | "allowances" | "wallet";

const BOTTOM_TABS: readonly BottomTabItem<BottomTab>[] = [
  { id: "assets", label: "Tài sản", icon: "ethereum" },
  { id: "swap", label: "Swap", icon: "swap-horizontal" },
  { id: "send", label: "Gửi", icon: "arrow-up-bold" },
  { id: "receive", label: "Nhận", icon: "qrcode" },
  { id: "more", label: "Thêm", icon: "dots-grid" },
];

const MORE_ITEMS: { id: CryptoTab; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { id: "bridge", label: "Đổi VND", icon: "bank-transfer" },
  { id: "history", label: "Lịch sử", icon: "history" },
  { id: "nft", label: "NFT", icon: "image-multiple" },
  { id: "allowances", label: "Quyền chi", icon: "shield-check" },
  { id: "wallet", label: "Quản lý ví", icon: "wallet-outline" },
];

function bottomActive(tab: CryptoTab): BottomTab {
  if (tab === "bridge" || tab === "history" || tab === "nft" || tab === "allowances" || tab === "wallet") {
    return "more";
  }
  return tab;
}

function CryptoTabs({ tab }: { tab: CryptoTab }) {
  if (tab === "assets") return <AssetsTab />;
  if (tab === "send") return <SendTab />;
  if (tab === "history") return <HistoryTab />;
  if (tab === "bridge") return <BridgeTab />;
  if (tab === "receive") return <ReceiveTab />;
  if (tab === "wallet") return <WalletTab />;
  if (tab === "swap") return <SwapTab />;
  if (tab === "nft") return <NftTab />;
  if (tab === "more") return <AssetsTab />;
  return <AllowancesTab />;
}

export function CryptoShellScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<CryptoTab>("assets");
  const [moreOpen, setMoreOpen] = useState(false);
  const theme = shellTheme.crypto;

  const onBottomChange = (id: BottomTab) => {
    if (id === "more") {
      setMoreOpen(true);
      return;
    }
    setTab(id);
  };

  const pickMore = (id: CryptoTab) => {
    setTab(id);
    setMoreOpen(false);
  };

  return (
    <ShellProvider shell="crypto">
      <CryptoProvider>
        <WalletLayout
          shell="crypto"
          title="Ví Crypto"
          subtitle="Web3 · 5 mạng EVM"
          onSwitchWallet={() => navigation.replace("WalletType")}
          onSignOut={() => signOut()}
          footer={
            <BottomTabBar shell="crypto" tabs={BOTTOM_TABS} active={bottomActive(tab)} onChange={onBottomChange} />
          }
        >
          <NetworkSwitcher />
          <View className="min-h-0 flex-1">
            <CryptoTabs tab={tab} />
          </View>

          <Modal visible={moreOpen} title="Thêm tính năng" onClose={() => setMoreOpen(false)}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row flex-wrap gap-3 pb-4">
                {MORE_ITEMS.map((item) => {
                  const selected = tab === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => pickMore(item.id)}
                      className="w-[47%] items-center gap-2 rounded-2xl border border-border p-4"
                      style={{
                        backgroundColor: selected ? theme.primarySoft : "rgba(255,255,255,0.03)",
                        borderColor: selected ? `${theme.primary}55` : "rgba(255,255,255,0.08)",
                      }}
                    >
                      <MaterialCommunityIcons name={item.icon} size={28} color={theme.primary} />
                      <Text className="text-center text-sm font-bold text-white">{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Modal>
        </WalletLayout>
      </CryptoProvider>
    </ShellProvider>
  );
}
