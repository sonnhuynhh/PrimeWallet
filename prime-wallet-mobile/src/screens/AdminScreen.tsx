import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { WalletLayout } from "../components/layout/WalletLayout";
import { TabBar, type TabItem } from "../components/ui/TabBar";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { toastErr, toastOk } from "../components/feedback/toast";
import { fmtNumber, fmtVnd } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import {
  getAllUsers,
  getAdminStats,
  getAdminTransactions,
  getAuditLogs,
  getAdminCryptoHistory,
  updateKycStatus,
  lockUser,
  unlockUser,
  runReconciliation,
  type AdminUserResponse,
  type AdminStats,
} from "../services/admin";
import type { AuditLogResponse, TransactionResponse } from "../types/api";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Admin">;
type AdminTab = "users" | "transactions" | "logs" | "crypto";

const TABS: readonly TabItem<AdminTab>[] = [
  { id: "users", label: "Người dùng", icon: "account-group" },
  { id: "transactions", label: "Giao dịch", icon: "swap-horizontal" },
  { id: "logs", label: "Nhật ký", icon: "file-document-outline" },
  { id: "crypto", label: "Blockchain", icon: "bitcoin" },
];

const NETWORKS = [
  { id: "eth_sepolia", label: "Sepolia" },
  { id: "bsc_mainnet", label: "BSC" },
  { id: "polygon_mainnet", label: "Polygon" },
  { id: "base_mainnet", label: "Base" },
];

export function AdminScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [tab, setTab] = useState<AdminTab>("users");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [txs, setTxs] = useState<TransactionResponse[]>([]);
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [cryptoAddress, setCryptoAddress] = useState("");
  const [cryptoNetwork, setCryptoNetwork] = useState("eth_sepolia");
  const [cryptoTxs, setCryptoTxs] = useState<{ hash: string; value: string; timeStamp: string }[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [s, u, t, l] = await Promise.all([
        getAdminStats(),
        getAllUsers(0, 30, search || undefined),
        getAdminTransactions(0, 30),
        getAuditLogs(0, 30),
      ]);
      setStats(s);
      setUsers(u.content);
      setTxs(t.content);
      setLogs(l.content);
    } catch (e) {
      toastErr(e, "Không tải được dữ liệu admin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tab]);

  const lookupCrypto = async () => {
    if (!cryptoAddress.startsWith("0x")) {
      toastErr("Địa chỉ không hợp lệ");
      return;
    }
    setLoading(true);
    try {
      const res = await getAdminCryptoHistory(cryptoAddress, cryptoNetwork);
      setCryptoTxs(Array.isArray(res.result) ? res.result : []);
    } catch (e) {
      toastErr(e, "Tra cứu blockchain thất bại");
      setCryptoTxs([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <WalletLayout
      shell="fiat"
      title="Quản trị"
      subtitle="Người dùng · Giao dịch · Blockchain"
      onSwitchWallet={() => navigation.replace("WalletType")}
      onSignOut={() => signOut()}
    >
      <TabBar shell="fiat" tabs={TABS} active={tab} onChange={setTab} />
      {loading && tab !== "crypto" ? (
        <ActivityIndicator className="mt-8" color="#21c95e" />
      ) : (
        <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
          {stats ? (
            <View className="mb-4 flex-row flex-wrap gap-2">
              <Stat label="Users" value={String(stats.totalUsers)} />
              <Stat label="Tx" value={String(stats.totalTransactions)} />
              <Stat label="Nạp" value={fmtVnd(stats.totalTopUp)} />
            </View>
          ) : null}

          {tab === "users" ? (
            <FlatList
              data={users}
              scrollEnabled={false}
              keyExtractor={(u) => u.id}
              contentContainerStyle={{ gap: 10 }}
              renderItem={({ item }) => (
                <Card className="gap-2">
                  <Text className="font-bold text-white">{item.fullName}</Text>
                  <Text className="text-xs text-muted-foreground">{item.email}</Text>
                  <View className="flex-row gap-2">
                    <Badge variant={item.kycStatus === "VERIFIED" ? "success" : "warning"}>{item.kycStatus}</Badge>
                    <Badge variant={item.status === "LOCKED" ? "danger" : "success"}>{item.status}</Badge>
                  </View>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    <Button title="KYC ✓" onPress={() => void updateKycStatus(item.id, "VERIFIED").then(load).catch(toastErr)} />
                    <Button title="KYC ✗" variant="ghost" onPress={() => void updateKycStatus(item.id, "REJECTED").then(load).catch(toastErr)} />
                    {item.status === "LOCKED" ? (
                      <Button title="Mở khóa" variant="ghost" onPress={() => void unlockUser(item.id).then(() => toastOk("Đã mở khóa")).then(load).catch(toastErr)} />
                    ) : (
                      <Button title="Khóa" variant="ghost" onPress={() => void lockUser(item.id).then(() => toastOk("Đã khóa")).then(load).catch(toastErr)} />
                    )}
                  </View>
                </Card>
              )}
            />
          ) : null}

          {tab === "transactions" ? (
            txs.map((tx) => (
              <Card key={tx.id} className="mb-2 gap-1">
                <Text className="font-bold text-white">{tx.transactionType}</Text>
                <Text className="text-sm text-muted-foreground">{tx.referenceNumber}</Text>
                <Text className="font-bold text-emerald-400">{fmtNumber(tx.amount, 0)} {tx.currency}</Text>
                <Badge variant={tx.status === "SUCCESS" ? "success" : tx.status === "FAILED" ? "danger" : "warning"}>{tx.status}</Badge>
              </Card>
            ))
          ) : null}

          {tab === "logs" ? (
            logs.map((log) => (
              <Card key={log.id} className="mb-2 gap-1">
                <Text className="font-bold text-white">{log.action}</Text>
                <Text className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("vi-VN")}</Text>
                {log.details ? <Text className="text-sm text-muted-foreground">{log.details}</Text> : null}
              </Card>
            ))
          ) : null}

          {tab === "crypto" ? (
            <View className="gap-3">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                {NETWORKS.map((n) => (
                  <Pressable key={n.id} onPress={() => setCryptoNetwork(n.id)} className="mr-2 rounded-full border border-border px-3 py-2" style={{ backgroundColor: cryptoNetwork === n.id ? "rgba(33,201,94,0.15)" : "transparent" }}>
                    <Text className="text-xs font-bold text-white">{n.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <TextInput
                className="rounded-2xl border border-border bg-surface-2 p-4 font-mono text-white"
                placeholder="0x..."
                placeholderTextColor="#64748b"
                value={cryptoAddress}
                onChangeText={setCryptoAddress}
                autoCapitalize="none"
              />
              <Button title="Tra cứu" onPress={() => void lookupCrypto()} loading={loading} />
              <Button title="Đối soát hôm nay" variant="ghost" onPress={() => void runReconciliation().then(() => toastOk("Đối soát xong")).catch(toastErr)} />
              {cryptoTxs.map((tx) => (
                <Card key={tx.hash} className="mb-2">
                  <Text className="font-mono text-xs text-white" numberOfLines={1}>{tx.hash}</Text>
                  <Text className="text-sm text-muted-foreground">{new Date(Number(tx.timeStamp) * 1000).toLocaleString("vi-VN")}</Text>
                </Card>
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
    </WalletLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="min-w-[30%] flex-1 gap-1 py-3">
      <Text className="text-[10px] uppercase text-muted-foreground">{label}</Text>
      <Text className="font-extrabold text-white">{value}</Text>
    </Card>
  );
}
