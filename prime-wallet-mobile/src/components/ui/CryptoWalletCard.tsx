import React, { useEffect, useState } from "react";
import { Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { ethers } from "ethers";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Card } from "./Card";
import { linkCryptoWallet, getLinkedWallets, getWalletBalance, CryptoWallet, WalletBalance } from "../../services/crypto";

export function CryptoWalletCard() {
  const [wallet, setWallet] = useState<CryptoWallet | null>(null);
  const [balanceInfo, setBalanceInfo] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [seedPhraseInput, setSeedPhraseInput] = useState("");
  const [generatedSeedPhrase, setGeneratedSeedPhrase] = useState<string | null>(null);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      setLoading(true);
      const wallets = await getLinkedWallets();
      const sepoliaWallet = wallets.find((w) => w.blockchainNetwork === "ETH_SEPOLIA");
      if (sepoliaWallet) {
        setWallet(sepoliaWallet);
        const balance = await getWalletBalance(sepoliaWallet.id);
        setBalanceInfo(balance);
      }
    } catch (e) {
      console.error("Failed to load crypto wallet", e);
    } finally {
      setLoading(false);
    }
  };

  const createWallet = async () => {
    try {
      setLoading(true);
      // Generate random wallet with Seed Phrase (Mnemonic)
      const newWallet = ethers.Wallet.createRandom();
      const phrase = newWallet.mnemonic?.phrase;
      
      if (!phrase) throw new Error("Không thể tạo Seed Phrase");
      
      // Save Private Key locally (in a real app, encrypt this with user pin)
      await AsyncStorage.setItem("crypto_private_key", newWallet.privateKey);
      
      // Show the seed phrase to the user
      setGeneratedSeedPhrase(phrase);
      
      // Link public address to backend
      const linked = await linkCryptoWallet(newWallet.address);
      setWallet(linked);
      
      // Fetch balance (will be 0)
      const balance = await getWalletBalance(linked.id);
      setBalanceInfo(balance);
    } catch (e) {
      console.error("Failed to create wallet", e);
      Alert.alert("Lỗi khi tạo ví: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const importWallet = async () => {
    try {
      const phrase = seedPhraseInput
        .split(/\s+/)
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length > 0)
        .join(" ");
        
      if (phrase.split(" ").length !== 12) {
        Alert.alert("Lỗi", "Vui lòng nhập đủ 12 từ khóa hợp lệ!");
        return;
      }
      setLoading(true);
      
      // Import from 12-word Seed Phrase
      const importedWallet = ethers.Wallet.fromPhrase(phrase);
      await AsyncStorage.setItem("crypto_private_key", importedWallet.privateKey);
      
      const linked = await linkCryptoWallet(importedWallet.address);
      setWallet(linked);
      
      const balance = await getWalletBalance(linked.id);
      setBalanceInfo(balance);
      setImporting(false);
    } catch (e: any) {
      console.error("Failed to import wallet", e);
      let errorMsg = "Lỗi khi import ví. Vui lòng kiểm tra lại.";
      if (e.message && e.message.includes("invalid mnemonic word")) {
        // Lỗi này xảy ra khi có từ không nằm trong từ điển BIP39 (ví dụ: sai chính tả)
        const match = e.message.match(/index ([0-9]+)/);
        if (match) {
          const index = parseInt(match[1]) + 1;
          errorMsg = `Từ khóa số ${index} bị sai chính tả hoặc không hợp lệ. Vui lòng kiểm tra lại.`;
        } else {
          errorMsg = "Một trong các từ khóa bị sai chính tả. Vui lòng kiểm tra lại.";
        }
      } else if (e.message && e.message.includes("invalid mnemonic checksum")) {
        errorMsg = "Checksum không hợp lệ. Chuỗi 12 từ khóa này không tạo thành một ví đúng.";
      }
      Alert.alert("Lỗi Import", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !wallet) {
    return (
      <Card className="gap-4 bg-violet-500/10 border border-violet-500/20 items-center py-8">
        <ActivityIndicator color="#8b5cf6" size="large" />
        <Text className="text-violet-300">Đang kết nối Blockchain...</Text>
      </Card>
    );
  }

  // Nếu vừa tạo ví thành công, bắt buộc người dùng lưu lại Seed Phrase
  if (generatedSeedPhrase) {
    return (
      <Card className="gap-4 border border-emerald-500/50 items-center py-6">
        <Text className="text-xl font-bold text-emerald-400">Tạo ví thành công!</Text>
        <Text className="text-slate-300 text-center px-4">
          Đây là 12 từ khóa khôi phục bí mật (Seed Phrase). Tuyệt đối không chia sẻ cho bất kỳ ai! Hệ thống không lưu trữ chúng, nếu mất bạn sẽ mất toàn bộ tài sản.
        </Text>
        <View className="bg-slate-800 p-4 rounded-xl border border-slate-700 w-full">
            <Text className="text-white font-mono text-lg text-center tracking-widest leading-8">
                {generatedSeedPhrase}
            </Text>
        </View>
        <TouchableOpacity 
            onPress={() => setGeneratedSeedPhrase(null)} 
            className="bg-emerald-600 px-6 py-3 rounded-full mt-2 w-full"
        >
          <Text className="text-white font-bold text-center">Tôi đã lưu 12 từ này lại an toàn</Text>
        </TouchableOpacity>
      </Card>
    );
  }

  if (!wallet) {
    return (
      <Card className="gap-3 border border-slate-700 items-center py-6">
        <Text className="text-lg font-semibold text-white">Ví Web3 (Non-Custodial)</Text>
        <Text className="leading-6 text-slate-400 text-center mb-4 px-2">
          Bạn toàn quyền nắm giữ tài sản. Kích hoạt bằng cách tạo mới hoặc nhập Seed Phrase (12 từ bảo mật).
        </Text>
        
        {importing ? (
          <View className="w-full gap-4">
            <TextInput
              className="bg-slate-800 text-white p-4 rounded-xl border border-slate-600 text-sm h-32"
              value={seedPhraseInput}
              onChangeText={setSeedPhraseInput}
              placeholder="Nhập 12 từ khóa khôi phục của bạn vào đây (cách nhau bởi dấu cách)..."
              placeholderTextColor="#94a3b8"
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={importWallet} className="bg-violet-600 px-6 py-3 rounded-full w-full">
              <Text className="text-white font-bold text-center">Xác nhận Import</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setImporting(false)} className="py-2">
              <Text className="text-slate-400 font-bold text-center">Hủy</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity onPress={createWallet} className="bg-violet-600 px-6 py-3 rounded-full mt-2 w-full">
              <Text className="text-white font-bold text-center">Tạo ví mới</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setImporting(true)} className="border border-violet-600 px-6 py-3 rounded-full mt-3 w-full">
              <Text className="text-violet-400 font-bold text-center">Import Seed Phrase</Text>
            </TouchableOpacity>
          </>
        )}
      </Card>
    );
  }

  return (
    <View className="gap-4">
      <Card className="gap-4 bg-violet-500/10 border border-violet-500/20">
        <View className="flex-row items-center justify-between">
            <Text className="text-sm text-violet-300">Tài sản Crypto (Sepolia)</Text>
            <View className="bg-violet-500/20 px-2 py-1 rounded-md">
                <Text className="text-xs text-violet-300">Testnet</Text>
            </View>
        </View>
        <Text className="text-4xl font-black text-white">
          {balanceInfo?.balanceEth ?? "0.00"} <Text className="text-2xl text-violet-400">ETH</Text>
        </Text>
        <Text className="text-xs text-slate-400 font-mono" numberOfLines={1} ellipsizeMode="middle">
          {wallet.walletAddress}
        </Text>
      </Card>
      
      <View className="flex-row gap-3">
        <TouchableOpacity className="flex-1 bg-violet-600 p-3 rounded-xl items-center">
            <Text className="text-white font-bold">Chuyển ETH</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-1 bg-slate-800 p-3 rounded-xl items-center">
            <Text className="text-violet-300 font-bold">Nhận</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
