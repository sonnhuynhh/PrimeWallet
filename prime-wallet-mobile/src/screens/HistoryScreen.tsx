import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import { Card } from "../components/ui/Card";
import { Screen } from "../components/ui/Screen";
import { useAuth } from "../context/AuthContext";
import { getTransactionHistory } from "../services/wallet";
import type { TransactionResponse } from "../types/api";

export function HistoryScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const accountId = session?.account?.id;

    if (!accountId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const page = await getTransactionHistory(accountId);
        setItems(page.content);
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.account?.id]);

  return (
    <Screen>
      <View className="flex-1 gap-4 py-4">
        <View>
          <Text className="text-sm uppercase tracking-[0.3em] text-emerald-300">History</Text>
          <Text className="mt-2 text-3xl font-black text-white">Lịch sử giao dịch</Text>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#34d399" />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
            renderItem={({ item }) => (
              <Card className="gap-2">
                <Text className="text-base font-semibold text-white">{item.transactionType}</Text>
                <Text className="text-sm text-slate-300">{item.referenceNumber}</Text>
                <Text className="text-sm text-slate-300">{item.description ?? "Không có mô tả"}</Text>
                <Text className="text-sm text-emerald-300">{Number(item.amount).toLocaleString("vi-VN")} {item.currency}</Text>
              </Card>
            )}
            ListEmptyComponent={<Card><Text className="text-slate-300">Chưa có giao dịch nào để hiển thị.</Text></Card>}
          />
        )}
      </View>
    </Screen>
  );
}
