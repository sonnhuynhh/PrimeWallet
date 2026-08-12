import { Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";

import { Card } from "../../ui/Card";
import { CopyField } from "../../ui/CopyField";
import { EmptyState } from "../../ui/EmptyState";
import { toastOk } from "../../feedback/toast";
import { networkLabel } from "../../../lib/chains";
import { useCrypto } from "../../../context/CryptoContext";
import { shellTheme } from "../../../theme/tokens";

export function ReceiveTab() {
  const { activeWallet } = useCrypto();
  const theme = shellTheme.crypto;

  if (!activeWallet) {
    return (
      <EmptyState icon="qrcode" title="Chưa có ví" description="Tạo hoặc liên kết ví để nhận crypto." />
    );
  }

  const copy = async () => {
    await Clipboard.setStringAsync(activeWallet.walletAddress);
    toastOk("Đã sao chép địa chỉ");
  };

  return (
    <View className="gap-4 px-4 py-4">
      <Card className="gap-5 py-6">
        <Text className="text-center text-lg font-bold text-white">Nhận crypto</Text>
        <Text className="text-center text-sm text-muted-foreground">
          Mạng: {networkLabel(activeWallet.blockchainNetwork)}
        </Text>
        <View className="items-center">
          <View
            className="items-center justify-center rounded-3xl border border-border p-5"
            style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
          >
            <QRCode
              value={activeWallet.walletAddress}
              size={200}
              color={theme.primary}
              backgroundColor="transparent"
            />
          </View>
        </View>
        <CopyField value={activeWallet.walletAddress} onCopy={() => void copy()} />
        <Text className="text-center text-xs leading-5 text-amber-400">
          Chỉ gửi tài sản đúng mạng — gửi sai mạng có thể mất tiền vĩnh viễn.
        </Text>
      </Card>
    </View>
  );
}
