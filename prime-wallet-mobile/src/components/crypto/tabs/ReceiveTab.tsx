import { Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Card } from "../../ui/Card";
import { toastOk } from "../../feedback/toast";
import { shortAddress } from "../../../lib/utils";
import { networkLabel } from "../../../lib/chains";
import { useCrypto } from "../../../context/CryptoContext";

export function ReceiveTab() {
  const { activeWallet } = useCrypto();

  if (!activeWallet) {
    return (
      <Card className="mx-4 my-4">
        <Text className="text-center text-muted-foreground">Tạo hoặc liên kết ví để nhận crypto.</Text>
      </Card>
    );
  }

  const copy = async () => {
    await Clipboard.setStringAsync(activeWallet.walletAddress);
    toastOk("Đã sao chép địa chỉ");
  };

  return (
    <View className="gap-4 px-4 py-4">
      <Card className="items-center gap-4 py-8">
        <MaterialCommunityIcons name="qrcode" size={80} color="#fc72ff" />
        <Text className="text-center text-sm text-muted-foreground">
          Mạng: {networkLabel(activeWallet.blockchainNetwork)}
        </Text>
        <Text className="text-center font-mono text-base text-white">{activeWallet.walletAddress}</Text>
        <Pressable onPress={() => void copy()} className="flex-row items-center gap-2 rounded-full bg-primary/20 px-4 py-2">
          <MaterialCommunityIcons name="content-copy" size={16} color="#fc72ff" />
          <Text className="font-bold text-primary">Sao chép {shortAddress(activeWallet.walletAddress)}</Text>
        </Pressable>
        <Text className="text-center text-xs text-amber-400">
          Chỉ gửi tài sản đúng mạng — gửi sai mạng có thể mất tiền.
        </Text>
      </Card>
    </View>
  );
}
