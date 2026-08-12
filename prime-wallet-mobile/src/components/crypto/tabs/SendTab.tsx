import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { ethers } from "ethers";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Button } from "../../ui/Button";
import { Card, CardHeader } from "../../ui/Card";
import { Input } from "../../ui/Input";
import { EmptyState } from "../../ui/EmptyState";
import { CryptoTabShell } from "../CryptoTabShell";
import { TokenChipRow } from "../TokenChipRow";
import { toastErr, toastOk } from "../../feedback/toast";
import { clampDecimals, fmtNumber } from "../../../lib/utils";
import { useCrypto } from "../../../context/CryptoContext";
import { estimateGas, sendTransaction } from "../../../services/crypto";
import { getPrivateKey } from "../../../storage/secureKeyStore";
import { rpcOf } from "../../../lib/chains";
import type { TokenBalance } from "../../../types/crypto";
import type { EstimateGasData } from "../../../types/crypto";
import { shellTheme } from "../../../theme/tokens";

export function SendTab() {
  const theme = shellTheme.crypto;
  const { activeWallet, activeNetwork, balance, tokenRows, loadBalance } = useCrypto();
  const [token, setToken] = useState<TokenBalance | null>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [gas, setGas] = useState<EstimateGasData | null>(null);
  const [gasLoading, setGasLoading] = useState(false);
  const [sending, setSending] = useState(false);

  if (!activeWallet) {
    return (
      <CryptoTabShell>
        <EmptyState icon="send" title="Chưa có ví" description="Tạo hoặc liên kết ví để gửi tài sản." />
      </CryptoTabShell>
    );
  }

  const selected = token ?? tokenRows[0] ?? null;
  const isNative = !selected?.contractAddress;
  const decimals = selected?.decimals ?? 18;
  const symbol = selected?.symbol ?? balance?.nativeSymbol ?? "ETH";
  const available = isNative ? String(balance?.balanceEth ?? "0") : (selected?.balance ?? "0");

  const addressValid = ethers.isAddress(to.trim());
  const amountValid = Number(amount) > 0 && Number(amount) <= Number(available);

  const setMax = () => setAmount(available);

  const previewGas = async () => {
    if (!addressValid || !amountValid) return;
    setGasLoading(true);
    try {
      const g = await estimateGas({
        blockchainNetwork: activeWallet.blockchainNetwork,
        fromAddress: activeWallet.walletAddress,
        toAddress: to.trim(),
        amount,
        tokenAddress: isNative ? undefined : selected?.contractAddress,
        tokenDecimals: isNative ? undefined : decimals,
      });
      setGas(g);
    } catch (e) {
      toastErr(e, "Không ước tính được gas");
    } finally {
      setGasLoading(false);
    }
  };

  const handleSend = async () => {
    if (!addressValid || !amountValid || !selected) return;
    setSending(true);
    try {
      const pk = await getPrivateKey();
      if (!pk) throw new Error("Không tìm thấy khóa ví");

      const provider = new ethers.JsonRpcProvider(rpcOf(activeWallet.blockchainNetwork, activeNetwork?.rpcUrl));
      const wallet = new ethers.Wallet(pk, provider);

      let signed: string;
      if (isNative) {
        const tx = await wallet.populateTransaction({
          to: to.trim(),
          value: ethers.parseEther(clampDecimals(amount, decimals)),
          gasLimit: gas ? BigInt(gas.gasLimit) : undefined,
        });
        signed = await wallet.signTransaction(tx);
      } else {
        const iface = new ethers.Interface(["function transfer(address to, uint256 value) returns (bool)"]);
        const data = iface.encodeFunctionData("transfer", [
          to.trim(),
          ethers.parseUnits(clampDecimals(amount, decimals), decimals),
        ]);
        const tx = await wallet.populateTransaction({
          to: selected.contractAddress!,
          data,
          gasLimit: gas ? BigInt(gas.gasLimit) : undefined,
        });
        signed = await wallet.signTransaction(tx);
      }

      const result = await sendTransaction({
        blockchainNetwork: activeWallet.blockchainNetwork,
        signedTransactionHex: signed,
        fromAddress: activeWallet.walletAddress,
        toAddress: to.trim(),
        amount,
        symbol,
        tokenAddress: selected.contractAddress,
      });

      toastOk("Gửi thành công", result.transactionHash.slice(0, 14) + "…");
      setTo("");
      setAmount("");
      setGas(null);
      await loadBalance();
    } catch (e) {
      toastErr(e, "Gửi thất bại");
    } finally {
      setSending(false);
    }
  };

  return (
    <CryptoTabShell>
      <Card className="gap-4">
        <CardHeader
          title="Gửi crypto"
          description="Ký offline · broadcast qua backend"
          icon={<MaterialCommunityIcons name="arrow-up-bold" size={20} color={theme.primary} />}
        />

        <View className="gap-2">
          <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Token</Text>
          <TokenChipRow
            items={tokenRows.map((t) => ({ id: t.symbol + (t.contractAddress ?? "n"), label: t.symbol }))}
            selectedId={selected ? selected.symbol + (selected.contractAddress ?? "n") : undefined}
            onSelect={(id) => {
              const t = tokenRows.find((x) => x.symbol + (x.contractAddress ?? "n") === id);
              if (t) setToken(t);
            }}
          />
        </View>

        <Input label="Địa chỉ nhận (0x…)" value={to} onChangeText={setTo} placeholder="0x…" />
        <Input
          label={`Số lượng · khả dụng ${fmtNumber(available)} ${symbol}`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          suffix={
            <Pressable onPress={setMax} className="rounded-full px-2 py-1" style={{ backgroundColor: theme.primarySoft }}>
              <Text className="text-xs font-bold" style={{ color: theme.primary }}>
                MAX
              </Text>
            </Pressable>
          }
        />

        {gas ? (
          <View className="rounded-2xl border border-border bg-white/5 p-3">
            <Text className="text-xs text-muted-foreground">Phí ước tính</Text>
            <Text className="font-bold text-white">
              {fmtNumber(gas.totalFeeEth, 8)} {gas.nativeSymbol}
            </Text>
          </View>
        ) : null}

        <View className="flex-row gap-2">
          <Button
            title="Ước tính gas"
            variant="outline"
            onPress={() => void previewGas()}
            loading={gasLoading}
            fullWidth={false}
            style={{ flex: 1 }}
          />
          <Button
            title="Gửi"
            onPress={() => void handleSend()}
            loading={sending}
            disabled={!addressValid || !amountValid}
            fullWidth={false}
            style={{ flex: 1 }}
          />
        </View>
      </Card>
    </CryptoTabShell>
  );
}
