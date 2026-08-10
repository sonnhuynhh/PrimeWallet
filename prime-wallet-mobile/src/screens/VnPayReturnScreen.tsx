import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";

import { confirmVnPayPayment } from "../services/payment";
import { useAuth } from "../context/AuthContext";

function queryFromUrl(url: string) {
  const qIndex = url.indexOf("?");
  return qIndex >= 0 ? url.slice(qIndex) : "";
}

export function VnPayReturnScreen() {
  const { reloadSession } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Đang xác nhận giao dịch...");

  useEffect(() => {
    void (async () => {
      try {
        const initial = await Linking.getInitialURL();
        const query = initial ? queryFromUrl(initial) : "";
        if (!query) {
          setStatus("error");
          setMessage("Thiếu thông tin giao dịch từ VNPAY.");
          return;
        }
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
    })();
  }, [reloadSession]);

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
