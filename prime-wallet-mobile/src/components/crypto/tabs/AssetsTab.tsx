import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { ethers } from "ethers";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Card } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { toastOk } from "../../feedback/toast";
import { fmtNumber, shortAddress } from "../../../lib/utils";
import { useCrypto } from "../../../context/CryptoContext";
import {
  createOwnershipChallenge,
  linkCryptoWalletWithProof,
} from "../../../services/crypto";
import { savePrivateKey } from "../../../storage/secureKeyStore";

export function AssetsTab() {
  const { activeWallet, activeNetwork, balance, tokenRows, refreshing, error, loadBalance, reload, address } =
    useCrypto();
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const [seedInput, setSeedInput] = useState("");
  const [generatedSeed, setGeneratedSeed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const linkWithProof = async (walletAddress: string, privateKey: string, network = "eth_sepolia") => {
    const challenge = await createOwnershipChallenge(walletAddress);
    const wallet = new ethers.Wallet(privateKey);
    const signature = await wallet.signMessage(challenge.message);
    await linkCryptoWalletWithProof({
      walletAddress,
      blockchainNetwork: network,
      message: challenge.message,
      signature,
    });
    await savePrivateKey(privateKey);
    await reload();
  };

  const createWallet = async () => {
    setBusy(true);
    try {
      const w = ethers.Wallet.createRandom();
      if (!w.mnemonic?.phrase) throw new Error("Không tạo được seed");
      setGeneratedSeed(w.mnemonic.phrase);
      await linkWithProof(w.address, w.privateKey);
    } catch (e) {
      Alert.alert("Lỗi", e instanceof Error ? e.message : "Tạo ví thất bại");
    } finally {
      setBusy(false);
    }
  };

  const importWallet = async () => {
    const phrase = seedInput.trim().toLowerCase().replace(/\s+/g, " ");
    if (phrase.split(" ").length !== 12) {
      Alert.alert("Lỗi", "Cần đủ 12 từ seed phrase");
      return;
    }
    setBusy(true);
    try {
      const w = ethers.Wallet.fromPhrase(phrase);
      await linkWithProof(w.address, w.privateKey);
      setImporting(false);
      setSeedInput("");
    } catch (e) {
      Alert.alert("Lỗi import", e instanceof Error ? e.message : "Seed không hợp lệ");
    } finally {
      setBusy(false);
    }
  };

  const copyAddress = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    setCopied(true);
    toastOk("Đã sao chép địa chỉ");
    setTimeout(() => setCopied(false), 2000);
  };

  if (generatedSeed) {
    return (
      <ScrollView className="flex-1 px-4 py-4">
        <Card className="gap-4 border border-emerald-500/40">
          <Text className="text-xl font-extrabold text-emerald-400">Lưu 12 từ khóa!</Text>
          <Text className="text-sm text-muted-foreground">
            PrimeWallet không lưu seed — mất là mất ví vĩnh viễn.
          </Text>
          <Text className="rounded-2xl bg-black/40 p-4 font-mono text-sm leading-7 text-white">{generatedSeed}</Text>
          <Button title="Tôi đã lưu an toàn" onPress={() => setGeneratedSeed(null)} />
        </Card>
      </ScrollView>
    );
  }

  if (!activeWallet) {
    return (
      <ScrollView className="flex-1 px-4 py-4">
        <Card className="items-center gap-4 py-10">
          <MaterialCommunityIcons name="wallet-outline" size={48} color="#fc72ff" />
          <Text className="text-xl font-extrabold text-white">Chưa có ví Crypto</Text>
          <Text className="text-center text-sm text-muted-foreground">
            Tạo ví mới hoặc import seed phrase 12 từ.
          </Text>
          {importing ? (
            <View className="w-full gap-3">
              <TextInput
                className="min-h-[100px] rounded-2xl border border-border bg-surface-2 p-4 text-white"
                multiline
                value={seedInput}
                onChangeText={setSeedInput}
                placeholder="12 từ seed phrase..."
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />
              <Button title="Xác nhận import" onPress={() => void importWallet()} loading={busy} />
              <Button title="Hủy" variant="ghost" onPress={() => setImporting(false)} />
            </View>
          ) : (
            <>
              <Button title="Tạo ví mới" onPress={() => void createWallet()} loading={busy} />
              <Button title="Import seed" variant="ghost" onPress={() => setImporting(true)} />
            </>
          )}
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
      <Card className="mb-4 gap-3 border border-primary/20" style={{ backgroundColor: "rgba(252,114,255,0.08)" }}>
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="mb-1 text-sm text-muted-foreground">
              Số dư · {activeNetwork?.label ?? activeNetwork?.name ?? activeWallet.blockchainNetwork}
            </Text>
            {refreshing && !balance ? (
              <ActivityIndicator color="#fc72ff" />
            ) : (
              <Text className="text-4xl font-extrabold text-white">
                {fmtNumber(balance?.balanceEth ?? "0", 6)}{" "}
                <Text className="text-2xl text-primary">{balance?.nativeSymbol ?? "ETH"}</Text>
              </Text>
            )}
          </View>
          <Pressable onPress={() => void loadBalance()} className="rounded-full border border-border p-2">
            <MaterialCommunityIcons name="refresh" size={18} color="#fc72ff" />
          </Pressable>
        </View>
        {error ? <Text className="text-sm text-rose-400">{error}</Text> : null}
        <Pressable onPress={() => void copyAddress()} className="flex-row items-center gap-2 rounded-xl bg-black/30 p-3">
          <Text className="flex-1 font-mono text-xs text-muted-foreground">{activeWallet.walletAddress}</Text>
          <MaterialCommunityIcons name={copied ? "check" : "content-copy"} size={16} color="#fc72ff" />
        </Pressable>
      </Card>

      <Card className="gap-2">
        <Text className="mb-2 font-extrabold text-white">Token</Text>
        {tokenRows.map((t) => (
          <View key={t.symbol + (t.contractAddress ?? "native")} className="flex-row items-center justify-between py-2">
            <View>
              <Text className="font-bold text-white">{t.symbol}</Text>
              <Text className="text-xs text-muted-foreground">{t.name}</Text>
            </View>
            <Text className="font-semibold text-primary">{fmtNumber(t.balance, 6)}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
