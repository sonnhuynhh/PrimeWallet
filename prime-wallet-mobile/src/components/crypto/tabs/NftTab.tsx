import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Card, CardHeader } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { useCrypto } from "../../../context/CryptoContext";
import { fetchNfts, type NftItem } from "../../../lib/nft/nftService";
import { ALCHEMY_API_KEY, ETHERSCAN_API_KEY } from "../../../config/env";
import { shellTheme } from "../../../theme/tokens";

export function NftTab() {
  const theme = shellTheme.crypto;
  const { activeWallet } = useCrypto();
  const [items, setItems] = useState<NftItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const load = async () => {
    if (!activeWallet) return;
    setLoading(true);
    const result = await fetchNfts({
      networkId: activeWallet.blockchainNetwork,
      owner: activeWallet.walletAddress,
      walletId: activeWallet.id,
      alchemyApiKey: ALCHEMY_API_KEY || undefined,
      etherscanApiKey: ETHERSCAN_API_KEY || undefined,
    });
    if (result.kind === "ok") {
      setItems(result.items);
      setReason(null);
    } else {
      setItems([]);
      setReason(result.reason);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [activeWallet?.id]);

  if (!activeWallet) {
    return (
      <View className="flex-1 px-4 py-8">
        <EmptyState icon="image-multiple" title="Chưa có ví" description="Liên kết ví để xem NFT gallery." />
      </View>
    );
  }

  return (
    <View className="flex-1 px-4 py-4">
      <View className="mb-4 flex-row items-center justify-between">
        <CardHeader
          title="NFT Gallery"
          description={`${items.length} item trên mạng hiện tại`}
          icon={<MaterialCommunityIcons name="image-multiple" size={20} color={theme.primary} />}
        />
        <Pressable onPress={() => void load()} hitSlop={8} className="rounded-full bg-white/5 p-2">
          <MaterialCommunityIcons name="refresh" size={18} color={theme.primary} />
        </Pressable>
      </View>

      {loading ? <ActivityIndicator color={theme.primary} className="mb-4" /> : null}
      {reason ? (
        <Text className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
          {reason}
        </Text>
      ) : null}

      <FlatList
        style={{ flex: 1 }}
        data={items}
        keyExtractor={(item) => `${item.contract}:${item.tokenId}`}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 24, flexGrow: 1 }}
        renderItem={({ item }) => (
          <Card className="flex-1 gap-2 p-2">
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} className="h-28 w-full rounded-xl" resizeMode="cover" />
            ) : (
              <View className="h-28 items-center justify-center rounded-xl bg-white/5">
                <MaterialCommunityIcons name="image-off-outline" size={24} color="#9b9b9b" />
              </View>
            )}
            <Text className="text-xs font-bold text-white" numberOfLines={1}>
              {item.name ?? `#${item.tokenId}`}
            </Text>
            <Text className="text-[10px] text-muted-foreground" numberOfLines={1}>
              {item.collection ?? item.contract.slice(0, 10)}
            </Text>
          </Card>
        )}
        ListEmptyComponent={
          !loading ? (
            <EmptyState icon="image-multiple" title="Chưa có NFT" description="NFT trên mạng này sẽ hiện ở đây." />
          ) : null
        }
      />
    </View>
  );
}
