import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { ethers } from "ethers";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Card, CardHeader } from "../../ui/Card";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";
import { CopyField } from "../../ui/CopyField";
import { EmptyState } from "../../ui/EmptyState";
import { CryptoTabShell } from "../CryptoTabShell";
import { toastOk } from "../../feedback/toast";
import { fmtNumber } from "../../../lib/utils";
import { nativeSymbolOf } from "../../../lib/chains";
import { useCrypto } from "../../../context/CryptoContext";
import { createOwnershipChallenge, linkCryptoWalletWithProof } from "../../../services/crypto";
import { savePrivateKey } from "../../../storage/secureKeyStore";
import { shellTheme } from "../../../theme/tokens";

export function AssetsTab() {
  const theme = shellTheme.crypto;
  const { activeWallet, activeNetwork, balance, tokenRows, refreshing, error, loadBalance, reload, address } =
    useCrypto();
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
    toastOk("Đã sao chép địa chỉ");
  };

  const nativeSymbol =
    activeNetwork?.nativeSymbol ?? nativeSymbolOf(activeWallet?.blockchainNetwork ?? "eth_sepolia");

  if (generatedSeed) {
    return (
      <CryptoTabShell>
        <Card className="gap-4" style={{ borderColor: `${theme.primary}55` }}>
          <CardHeader
            title="Lưu 12 từ khóa!"
            description="PrimeWallet không lưu seed — mất là mất ví vĩnh viễn."
            icon={<MaterialCommunityIcons name="shield-alert" size={20} color={theme.primary} />}
          />
          <Text className="rounded-2xl bg-black/40 p-4 font-mono text-sm leading-7 text-white">{generatedSeed}</Text>
          <Button title="Tôi đã lưu an toàn" onPress={() => setGeneratedSeed(null)} />
        </Card>
      </CryptoTabShell>
    );
  }

  if (!activeWallet) {
    return (
      <CryptoTabShell>
        <Card className="gap-4 py-6">
          <EmptyState
            icon="wallet-outline"
            title="Chưa có ví Crypto"
            description="Tạo ví mới hoặc import seed phrase 12 từ."
          />
          {importing ? (
            <View className="gap-3">
              <Input
                label="Seed phrase (12 từ)"
                value={seedInput}
                onChangeText={setSeedInput}
                placeholder="word1 word2 word3 …"
                multiline
              />
              <Button title="Xác nhận import" onPress={() => void importWallet()} loading={busy} />
              <Button title="Hủy" variant="ghost" onPress={() => setImporting(false)} />
            </View>
          ) : (
            <View className="gap-3">
              <Button title="Tạo ví mới" onPress={() => void createWallet()} loading={busy} />
              <Button title="Import seed" variant="outline" onPress={() => setImporting(true)} />
            </View>
          )}
        </Card>
      </CryptoTabShell>
    );
  }

  return (
    <CryptoTabShell>
      <Card className="mb-4 gap-4" style={{ backgroundColor: theme.primarySoft, borderColor: `${theme.primary}33` }}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Số dư · {activeNetwork?.label ?? activeNetwork?.name ?? activeWallet.blockchainNetwork}
            </Text>
            {refreshing && !balance ? (
              <ActivityIndicator color={theme.primary} className="mt-2" />
            ) : (
              <Text className="mt-1 text-4xl font-extrabold text-white">
                {fmtNumber(balance?.balanceEth ?? "0", 6)}{" "}
                <Text className="text-2xl" style={{ color: theme.primary }}>
                  {balance?.nativeSymbol ?? nativeSymbol}
                </Text>
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => void loadBalance()}
            className="rounded-2xl border border-border p-2.5"
            style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
          >
            <MaterialCommunityIcons name="refresh" size={18} color={theme.primary} />
          </Pressable>
        </View>
        {error ? <Text className="text-sm text-rose-400">{error}</Text> : null}
        {address ? <CopyField value={address} onCopy={() => void copyAddress()} /> : null}
      </Card>

      <Card className="gap-1">
        <CardHeader
          title="Token"
          description={`${tokenRows.length} tài sản trên mạng hiện tại`}
          icon={<MaterialCommunityIcons name="circle-multiple" size={20} color={theme.primary} />}
        />
        {tokenRows.length === 0 ? (
          <Text className="py-4 text-center text-sm text-muted-foreground">Chưa có token.</Text>
        ) : (
          tokenRows.map((t, idx) => (
            <View
              key={t.symbol + (t.contractAddress ?? "native")}
              className={`flex-row items-center justify-between py-3 ${idx < tokenRows.length - 1 ? "border-b border-border" : ""}`}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: theme.primarySoft }}
                >
                  <Text className="text-xs font-extrabold" style={{ color: theme.primary }}>
                    {t.symbol.slice(0, 3)}
                  </Text>
                </View>
                <View>
                  <Text className="font-bold text-white">{t.symbol}</Text>
                  <Text className="text-xs text-muted-foreground">{t.name}</Text>
                </View>
              </View>
              <Text className="font-semibold" style={{ color: theme.primary }}>
                {fmtNumber(t.balance, 6)}
              </Text>
            </View>
          ))
        )}
      </Card>
    </CryptoTabShell>
  );
}
