import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Text, View } from "react-native";

import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { useCrypto } from "../../../context/CryptoContext";
import { fetchNfts, type NftItem } from "../../../lib/nft/nftService";
import { ALCHEMY_API_KEY, ETHERSCAN_API_KEY } from "../../../config/env";

export function NftTab() {
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
      <Card className="mx-4 my-4">
        <Text className="text-center text-muted-foreground">Liên kết ví để xem NFT.</Text>
      </Card>
    );
  }

  return (
    <View className="flex-1 px-4 py-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-extrabold text-white">NFT Gallery</Text>
        <Button title="Làm mới" variant="ghost" onPress={() => void load()} />
      </View>

      {loading ? <ActivityIndicator color="#fc72ff" /> : null}
      {reason ? <Text className="mb-3 text-sm text-amber-400">{reason}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => `${item.contract}:${item.tokenId}`}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card className="flex-1 gap-2 p-2">
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} className="h-28 w-full rounded-xl" resizeMode="cover" />
            ) : (
              <View className="h-28 items-center justify-center rounded-xl bg-white/5">
                <Text className="text-xs text-muted-foreground">No image</Text>
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
          !loading ? <Text className="text-muted-foreground">Chưa có NFT trên mạng này.</Text> : null
        }
      />
    </View>
  );
}
