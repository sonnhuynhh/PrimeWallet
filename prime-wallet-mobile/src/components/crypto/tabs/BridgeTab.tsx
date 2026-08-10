import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ethers } from "ethers";

import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Input } from "../../ui/Input";
import { Badge } from "../../ui/Badge";
import { toastErr, toastOk } from "../../feedback/toast";
import { clampDecimals, fmtNumber, fmtVnd } from "../../../lib/utils";
import { rpcOf } from "../../../lib/chains";
import { useAuth } from "../../../context/AuthContext";
import { useCrypto } from "../../../context/CryptoContext";
import {
  confirmBridgeOrder,
  createBridgeQuote,
  getBridgeRates,
  type BridgeQuote,
  type BridgeRates,
} from "../../../services/bridge";
import type { TokenInfo } from "../../../services/crypto";

async function waitForReceipt(rpcUrl: string, hash: string) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  for (let i = 0; i < 30; i += 1) {
    const receipt = await provider.getTransactionReceipt(hash);
    if (receipt) return receipt;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Giao dịch chưa được xác nhận on-chain");
}

export function BridgeTab() {
  const { reloadSession } = useAuth();
  const { activeWallet, balance, tokens, signAndSend, reload } = useCrypto();
  const [amount, setAmount] = useState("");
  const [symbol, setSymbol] = useState("ETH");
  const [quote, setQuote] = useState<BridgeQuote | null>(null);
  const [rates, setRates] = useState<BridgeRates | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const nativeSymbol = balance?.nativeSymbol ?? "ETH";
  const selectable = useMemo(() => {
    const erc20 = tokens.filter((t: TokenInfo) => t.symbol !== nativeSymbol);
    return [nativeSymbol, ...erc20.map((t: TokenInfo) => t.symbol)];
  }, [nativeSymbol, tokens]);
  const selectedToken = tokens.find((t: TokenInfo) => t.symbol === symbol);
  const isNative = symbol === nativeSymbol;
  const decimals = isNative ? 18 : (selectedToken?.decimals ?? 18);
  const available = isNative ? String(balance?.balanceEth ?? "0") : "0";

  useEffect(() => {
    if (!activeWallet) return;
    void getBridgeRates(activeWallet.blockchainNetwork)
      .then(setRates)
      .catch(() => setRates(null));
  }, [activeWallet?.id, activeWallet?.blockchainNetwork]);

  if (!activeWallet) {
    return (
      <Card className="mx-4 my-4">
        <Text className="text-center text-muted-foreground">Liên kết ví để đổi sang VND.</Text>
      </Card>
    );
  }

  const handleQuote = async () => {
    if (!amount || Number(amount) <= 0) return;
    setQuoting(true);
    setQuote(null);
    try {
      const q = await createBridgeQuote({
        cryptoWalletId: activeWallet.id,
        tokenSymbol: symbol,
        tokenAddress: isNative ? undefined : selectedToken?.contractAddress,
        tokenDecimals: isNative ? undefined : decimals,
        amount: clampDecimals(amount, decimals),
      });
      setQuote(q);
    } catch (e) {
      toastErr(e, "Không tạo được báo giá");
    } finally {
      setQuoting(false);
    }
  };

  const handleBridge = async () => {
    if (!quote) return;
    setSubmitting(true);
    try {
      const hash = isNative
        ? await signAndSend({
            to: quote.treasuryAddress,
            value: ethers.parseEther(clampDecimals(amount, decimals)),
          })
        : await signAndSend({
            to: selectedToken!.contractAddress!,
            data: new ethers.Interface(["function transfer(address to, uint256 value)"]).encodeFunctionData(
              "transfer",
              [quote.treasuryAddress, ethers.parseUnits(clampDecimals(amount, decimals), decimals)],
            ),
          });

      await waitForReceipt(rpcOf(activeWallet.blockchainNetwork), hash);
      const order = await confirmBridgeOrder(quote.orderId, hash);
      await reloadSession();
      await reload();
      toastOk("Đổi sang VND thành công", `+${fmtVnd(order.vndAmount)} đã cộng vào ví Fiat`);
      setAmount("");
      setQuote(null);
    } catch (e) {
      toastErr(e, "Đổi sang VND thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const liveRate = rates?.rates?.[symbol];

  return (
    <View className="gap-4 px-4 py-4">
      <Card className="gap-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-extrabold text-white">Đổi Crypto → VND</Text>
          <Badge variant="primary">{rates?.source === "coingecko" ? "Realtime" : "Tỷ giá"}</Badge>
        </View>
        {liveRate ? (
          <Text className="text-sm text-muted-foreground">
            1 {symbol} ≈ {fmtVnd(liveRate)}
          </Text>
        ) : null}

        <Input label="Token" value={symbol} onChangeText={setSymbol} placeholder={selectable.join(", ")} />
        <Input
          label={`Số lượng (khả dụng: ${fmtNumber(available)})`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <Button title="Báo giá" onPress={() => void handleQuote()} loading={quoting} />

        {quote ? (
          <View className="gap-2 rounded-2xl border border-border bg-white/5 p-3">
            <Text className="font-bold text-white">Nhận: {fmtVnd(quote.vndAmount)}</Text>
            <Text className="text-xs text-muted-foreground">Treasury: {quote.treasuryAddress}</Text>
            <Button title="Gửi & xác nhận" onPress={() => void handleBridge()} loading={submitting} />
          </View>
        ) : null}
      </Card>
    </View>
  );
}
