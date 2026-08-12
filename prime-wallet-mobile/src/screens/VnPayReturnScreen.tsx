import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { confirmVnPayPayment } from "../services/payment";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "VnPayReturn">;

function queryFromUrl(url: string) {
  const qIndex = url.indexOf("?");
  return qIndex >= 0 ? url.slice(qIndex) : "";
}

function normalizeQuery(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw.startsWith("?") ? raw : `?${raw}`;
}

/** Ghép lại query string từ deep-link params (React Navigation tách từng key). */
function queryFromParams(params: Record<string, unknown> | undefined): string {
  if (!params) return "";
  if (typeof params.query === "string" && params.query.length > 0) {
    return normalizeQuery(params.query);
  }
  const entries = Object.entries(params).filter(
    ([k, v]) => k !== "query" && v != null && String(v).length > 0,
  );
  if (entries.length === 0) return "";
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return `?${qs}`;
}

export function VnPayReturnScreen({ route }: Props) {
  const { reloadSession } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Đang xác nhận giao dịch...");

  const confirm = useCallback(
    async (query: string) => {
      if (!query) {
        setStatus("error");
        setMessage("Thiếu thông tin giao dịch từ VNPAY.");
        return;
      }
      try {
        const result = await confirmVnPayPayment(query);
        if (result.credited || result.alreadyProcessed) {
          setStatus("success");
          setMessage(result.message);
          setTimeout(() => void reloadSession(), 400);
        } else {
          setStatus("error");
          setMessage(result.message);
        }
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Không xác nhận được giao dịch.");
      }
    },
    [reloadSession],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const fromRoute = queryFromParams(route.params as Record<string, unknown> | undefined);
      if (fromRoute) {
        if (!cancelled) await confirm(fromRoute);
        return;
      }

      const initial = await Linking.getInitialURL();
      const fromInitial = initial ? queryFromUrl(initial) : "";
      if (fromInitial) {
        if (!cancelled) await confirm(fromInitial);
        return;
      }

      if (!cancelled) {
        setStatus("error");
        setMessage("Thiếu thông tin giao dịch từ VNPAY.");
      }
    })();

    const sub = Linking.addEventListener("url", ({ url }) => {
      const q = queryFromUrl(url);
      if (q) void confirm(q);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [confirm, route.params]);

  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      {status === "loading" ? <ActivityIndicator size="large" color="#21c95e" /> : null}
      <Text className="mt-6 text-center text-xl font-extrabold text-white">
        {status === "loading" ? "Đang xử lý..." : status === "success" ? "Nạp tiền thành công!" : "Giao dịch chưa hoàn tất"}
      </Text>
      <Text className="mt-2 text-center text-sm text-muted-foreground">{message}</Text>
    </View>
  );
}
