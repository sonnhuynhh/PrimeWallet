import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { ethers } from "ethers";

import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Input } from "../../ui/Input";
import { toastErr, toastOk } from "../../feedback/toast";
import { clampDecimals, fmtNumber } from "../../../lib/utils";
import { useCrypto } from "../../../context/CryptoContext";
import { estimateGas, sendTransaction } from "../../../services/crypto";
import { getPrivateKey } from "../../../storage/secureKeyStore";
import { rpcOf } from "../../../lib/chains";
import type { TokenBalance } from "../../../types/crypto";
import type { EstimateGasData } from "../../../types/crypto";

export function SendTab() {
  const { activeWallet, activeNetwork, balance, tokenRows, loadBalance } = useCrypto();
  const [token, setToken] = useState<TokenBalance | null>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [gas, setGas] = useState<EstimateGasData | null>(null);
  const [gasLoading, setGasLoading] = useState(false);
  const [sending, setSending] = useState(false);

  if (!activeWallet) {
    return (
      <Card className="mx-4 my-4">
        <Text className="text-center text-muted-foreground">Liên kết ví để gửi tài sản.</Text>
      </Card>
    );
  }

  const selected = token ?? tokenRows[0] ?? null;
  const isNative = !selected?.contractAddress;
  const decimals = selected?.decimals ?? 18;
  const symbol = selected?.symbol ?? balance?.nativeSymbol ?? "ETH";
  const available = isNative ? String(balance?.balanceEth ?? "0") : (selected?.balance ?? "0");

  const addressValid = ethers.isAddress(to.trim());
  const amountValid = Number(amount) > 0 && Number(amount) <= Number(available);

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
    <ScrollView className="flex-1 px-4 py-4">
      <Card className="gap-4">
        <Text className="text-lg font-extrabold text-white">Gửi crypto</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
          {tokenRows.map((t) => (
            <Button
              key={t.symbol + (t.contractAddress ?? "n")}
              title={t.symbol}
              variant={selected?.symbol === t.symbol ? "primary" : "ghost"}
              onPress={() => setToken(t)}
            />
          ))}
        </ScrollView>

        <Input label="Địa chỉ nhận (0x…)" value={to} onChangeText={setTo} />
        <Input
          label={`Số lượng (khả dụng ${fmtNumber(available)})`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        {gas ? (
          <Text className="text-sm text-muted-foreground">
            Phí ước tính: {fmtNumber(gas.totalFeeEth, 8)} {gas.nativeSymbol}
          </Text>
        ) : null}

        <Button title="Ước tính gas" variant="ghost" onPress={() => void previewGas()} loading={gasLoading} />
        <Button title="Gửi" onPress={() => void handleSend()} loading={sending} />
      </Card>
    </ScrollView>
  );
}
