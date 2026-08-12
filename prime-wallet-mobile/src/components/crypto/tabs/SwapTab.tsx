import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ethers } from "ethers";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Button } from "../../ui/Button";
import { Card, CardHeader } from "../../ui/Card";
import { Input } from "../../ui/Input";
import { Badge } from "../../ui/Badge";
import { EmptyState } from "../../ui/EmptyState";
import { CryptoTabShell } from "../CryptoTabShell";
import { TokenChipRow } from "../TokenChipRow";
import { toastErr, toastOk } from "../../feedback/toast";
import { clampDecimals } from "../../../lib/utils";
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
import { shellTheme } from "../../../theme/tokens";

export function SwapTab() {
  const theme = shellTheme.crypto;
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
  const outAmount = quote ? ethers.formatUnits(quote.toAmount, quote.tokenOut.decimals) : "";

  const flipTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountText("");
  };

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
      <CryptoTabShell>
        <EmptyState
          icon="alert-circle-outline"
          title="Mạng chưa hỗ trợ swap"
          description={`Swap trên Sepolia hoặc Ethereum mainnet. Hiện tại: ${activeNetwork?.label ?? activeNetwork?.name ?? "—"}`}
        />
      </CryptoTabShell>
    );
  }

  return (
    <CryptoTabShell>
      <Card className="gap-4">
        <CardHeader
          title="Swap"
          description="Uniswap V3 engine · Sepolia"
          icon={<MaterialCommunityIcons name="swap-horizontal" size={20} color={theme.primary} />}
          action={quote ? <Badge variant="primary">{quote.tool}</Badge> : null}
        />

        <View className="gap-2">
          <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Bán</Text>
          <Input value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" placeholder="0.0" />
          <TokenChipRow
            items={tokens.map((t) => ({ id: t.symbol, label: t.symbol }))}
            selectedId={tokenIn.symbol}
            onSelect={(id) => {
              const t = tokens.find((x) => x.symbol === id);
              if (t && t.symbol !== tokenOut.symbol) setTokenIn(t);
            }}
          />
        </View>

        <Pressable onPress={flipTokens} className="self-center rounded-full border border-border bg-white/5 p-2">
          <MaterialCommunityIcons name="swap-vertical" size={22} color={theme.primary} />
        </Pressable>

        <View className="gap-2">
          <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mua (ước tính)</Text>
          <View className="rounded-2xl border border-border bg-surface-2/90 p-4">
            <Text className="text-2xl font-extrabold text-white">
              {quoteQuery.loading ? "…" : outAmount || "0"} {tokenOut.symbol}
            </Text>
          </View>
          <TokenChipRow
            items={tokens.filter((t) => t.symbol !== tokenIn.symbol).map((t) => ({ id: t.symbol, label: t.symbol }))}
            selectedId={tokenOut.symbol}
            onSelect={(id) => {
              const t = tokens.find((x) => x.symbol === id);
              if (t) setTokenOut(t);
            }}
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Slippage</Text>
          <View className="flex-row flex-wrap gap-2">
            {SLIPPAGE_PRESETS_BPS.map((bps) => (
              <Pressable
                key={bps}
                onPress={() => setSlippageBps(bps)}
                className="rounded-full border px-3 py-1.5"
                style={{
                  backgroundColor: slippageBps === bps ? theme.primarySoft : "transparent",
                  borderColor: slippageBps === bps ? `${theme.primary}55` : "rgba(255,255,255,0.08)",
                }}
              >
                <Text className="text-xs font-bold text-white">{(bps / 100).toFixed(2)}%</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {quoteQuery.loading ? <ActivityIndicator color={theme.primary} /> : null}

        {quote ? (
          <Card bare className="gap-2 border border-border bg-black/20 p-4">
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

        <Button title="Swap" onPress={() => void handleSwap()} loading={submitting} disabled={!quote || amountIn === 0n} />
      </Card>
    </CryptoTabShell>
  );
}
