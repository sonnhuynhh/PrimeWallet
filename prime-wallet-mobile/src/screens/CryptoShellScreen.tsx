import { useState } from "react";
import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { WalletLayout } from "../components/layout/WalletLayout";
import { TabBar, type TabItem } from "../components/ui/TabBar";
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
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Crypto">;

type CryptoTab = "assets" | "swap" | "bridge" | "send" | "receive" | "history" | "nft" | "allowances" | "wallet";

const TABS: readonly TabItem<CryptoTab>[] = [
  { id: "assets", label: "Tài sản", icon: "ethereum" },
  { id: "swap", label: "Swap", icon: "swap-horizontal" },
  { id: "bridge", label: "Đổi VND", icon: "bank-transfer" },
  { id: "send", label: "Gửi", icon: "arrow-up-bold" },
  { id: "receive", label: "Nhận", icon: "qrcode" },
  { id: "history", label: "Lịch sử", icon: "history" },
  { id: "nft", label: "NFT", icon: "image-multiple" },
  { id: "allowances", label: "Quyền", icon: "shield-check" },
  { id: "wallet", label: "Ví", icon: "wallet-outline" },
];

function CryptoTabs({ tab }: { tab: CryptoTab }) {
  if (tab === "assets") return <AssetsTab />;
  if (tab === "send") return <SendTab />;
  if (tab === "history") return <HistoryTab />;
  if (tab === "bridge") return <BridgeTab />;
  if (tab === "receive") return <ReceiveTab />;
  if (tab === "wallet") return <WalletTab />;
  if (tab === "swap") return <SwapTab />;
  if (tab === "nft") return <NftTab />;
  return <AllowancesTab />;
}

export function CryptoShellScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<CryptoTab>("assets");

  return (
    <CryptoProvider>
      <WalletLayout
        shell="crypto"
        title="Ví Crypto"
        subtitle="Web3 · 5 mạng EVM"
        onSwitchWallet={() => navigation.replace("WalletType")}
        onSignOut={() => signOut()}
      >
        <NetworkSwitcher />
        <TabBar shell="crypto" tabs={TABS} active={tab} onChange={setTab} />
        <View className="min-h-0 flex-1">
          <CryptoTabs tab={tab} />
        </View>
      </WalletLayout>
    </CryptoProvider>
  );
}
