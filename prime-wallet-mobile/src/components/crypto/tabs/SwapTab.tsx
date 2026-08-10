import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { ethers } from "ethers";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { Input } from "../../ui/Input";
import { Badge } from "../../ui/Badge";
import { toastErr, toastOk } from "../../feedback/toast";
import { clampDecimals, fmtNumber } from "../../../lib/utils";
import { useSwapQuote } from "../../../hooks/useSwapQuote";
import { useCrypto } from "../../../context/CryptoContext";
import {
  DEFAULT_SLIPPAGE_BPS,
  SLIPPAGE_PRESETS_BPS,
  SEPOLIA_TOKENS,
  isSwapSupported,
  needsSwapApproval,
  buildApproveCalldata,
  isNativeAddress,
  feeLabel,
  type DexToken,
} from "../../../lib/dex";

export function SwapTab() {
  const { chainId, address, activeNetwork, signAndSend } = useCrypto();
  const tokens = useMemo<DexToken[]>(() => SEPOLIA_TOKENS, []);
  const [tokenIn, setTokenIn] = useState<DexToken>(tokens[0]);
  const [tokenOut, setTokenOut] = useState<DexToken>(tokens[2]);
  const [amountText, setAmountText] = useState("");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [submitting, setSubmitting] = useState(false);

  const supported = isSwapSupported(chainId);
  const amountIn = useMemo(() => {
    if (!amountText || Number(amountText) <= 0) return 0n;
    try {
      return ethers.parseUnits(clampDecimals(amountText, tokenIn.decimals), tokenIn.decimals);
    } catch {
      return 0n;
    }
  }, [amountText, tokenIn.decimals]);

  const quoteQuery = useSwapQuote({
    chainId,
    tokenIn,
    tokenOut,
    amountIn,
    slippageBps,
    account: address,
    networkId: activeNetwork?.id,
    enabled: supported,
  });

  const quote = quoteQuery.data;

  const handleSwap = async () => {
    if (!quote || !address || !chainId || !activeNetwork) return;
    setSubmitting(true);
    try {
      const networkId = activeNetwork.id;
      if (
        !isNativeAddress(tokenIn.address) &&
        (await needsSwapApproval({
          networkId,
          owner: address,
          tokenIn,
          spender: quote.approvalAddress,
          amountIn,
        }))
      ) {
        await signAndSend({
          to: tokenIn.address,
          data: buildApproveCalldata(quote.approvalAddress),
          value: 0n,
        });
        toastOk("Đã approve token", `${tokenIn.symbol}`);
      }

      const hash = await signAndSend({
        to: quote.txRequest.to,
        data: quote.txRequest.data,
        value: quote.txRequest.value,
        gasLimit: quote.txRequest.gasLimit,
      });
      toastOk("Đã phát lệnh swap", hash.slice(0, 10) + "…");
      setAmountText("");
    } catch (e) {
      toastErr(e, "Swap thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  if (!supported) {
    return (
      <Card className="mx-4 my-4 items-center gap-2 py-8">
        <MaterialCommunityIcons name="alert" size={32} color="#fbbf24" />
        <Text className="text-center font-bold text-white">Mạng chưa hỗ trợ swap</Text>
        <Text className="text-center text-sm text-muted-foreground">
          Swap trên Sepolia hoặc Ethereum mainnet. Hiện tại: {activeNetwork?.label ?? activeNetwork?.name ?? "—"}
        </Text>
      </Card>
    );
  }

  const outAmount = quote ? ethers.formatUnits(quote.toAmount, quote.tokenOut.decimals) : "";

  return (
    <ScrollView className="flex-1 px-4 py-4" showsVerticalScrollIndicator={false}>
      <Card className="gap-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-extrabold text-white">Swap</Text>
          {quote ? <Badge variant="primary">{quote.tool}</Badge> : null}
        </View>

        <Input label={`Bán (${tokenIn.symbol})`} value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" />
        <Input label={`Mua (${tokenOut.symbol})`} value={tokenOut.symbol} onChangeText={() => {}} />
        <Text className="text-sm text-muted-foreground">
          Nhận ≈ {quoteQuery.loading ? "…" : outAmount || "0"} {tokenOut.symbol}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
          {SLIPPAGE_PRESETS_BPS.map((bps) => (
            <Pressable
              key={bps}
              onPress={() => setSlippageBps(bps)}
              className="mr-2 rounded-full border border-border px-3 py-1.5"
              style={{ backgroundColor: slippageBps === bps ? "rgba(252,114,255,0.15)" : "transparent" }}
            >
              <Text className="text-xs font-bold text-white">{(bps / 100).toFixed(2)}%</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View className="flex-row gap-2">
          {tokens.map((t) => (
            <Pressable key={t.symbol} onPress={() => setTokenIn(t)} className="rounded-full bg-white/5 px-2 py-1">
              <Text className="text-xs text-primary">{t.symbol}</Text>
            </Pressable>
          ))}
        </View>
        <View className="flex-row gap-2">
          {tokens.filter((t) => t.symbol !== tokenIn.symbol).map((t) => (
            <Pressable key={t.symbol} onPress={() => setTokenOut(t)} className="rounded-full bg-white/5 px-2 py-1">
              <Text className="text-xs text-muted-foreground">{t.symbol}</Text>
            </Pressable>
          ))}
        </View>

        {quoteQuery.loading ? <ActivityIndicator color="#fc72ff" /> : null}

        {quote ? (
          <Card className="gap-2 border border-border bg-black/20">
            <Text className="text-xs font-bold uppercase text-muted-foreground">
              Route · {quote.route.source === "engine" ? "Uniswap V3" : "Aggregator"}
            </Text>
            {quote.route.hops.map((hop, i) => (
              <Text key={i} className="text-sm text-white">
                {hop.symbolIn} → {hop.symbolOut}
                {hop.fee != null ? ` (${feeLabel(hop.fee)})` : ""}
              </Text>
            ))}
            {quote.priceImpactPct != null ? (
              <Text className="text-xs text-muted-foreground">
                Price impact: {(quote.priceImpactPct * 100).toFixed(3)}%
              </Text>
            ) : null}
            {quote.gasUsd != null ? (
              <Text className="text-xs text-muted-foreground">Gas ≈ ${quote.gasUsd.toFixed(2)}</Text>
            ) : null}
          </Card>
        ) : null}

        <Button title="Swap" onPress={() => void handleSwap()} loading={submitting} />
      </Card>
    </ScrollView>
  );
}
