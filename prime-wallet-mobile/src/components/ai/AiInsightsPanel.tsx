import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Card, CardHeader } from "../ui/Card";
import { getAiInsights, getAiRiskScore, type AiInsightsData, type AiRiskScoreData } from "../../services/ai";
import { shellTheme } from "../../theme/tokens";

export function AiInsightsPanel() {
  const theme = shellTheme.fiat;
  const [insights, setInsights] = useState<AiInsightsData | null>(null);
  const [risk, setRisk] = useState<AiRiskScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [i, r] = await Promise.allSettled([getAiInsights(), getAiRiskScore()]);
    setInsights(i.status === "fulfilled" ? i.value : null);
    setRisk(r.status === "fulfilled" ? r.value : null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const aiDown =
    (insights === null && risk === null) ||
    insights?.available === false ||
    risk?.available === false;
  const riskLevel = risk?.level ?? "SAFE";
  const riskColor = riskLevel === "HIGH" ? "#fb7185" : riskLevel === "MEDIUM" ? "#fbbf24" : theme.primary;

  return (
    <Card className="mb-4 gap-3" style={{ borderColor: `${theme.primary}33` }}>
      <CardHeader
        title="AI Insights"
        description="Phân tích rủi ro & gợi ý tài chính"
        icon={<MaterialCommunityIcons name="creation" size={20} color={theme.primary} />}
        action={
          <Pressable onPress={() => void load()}>
            <Text className="text-xs font-bold" style={{ color: theme.primary }}>
              Làm mới
            </Text>
          </Pressable>
        }
      />

      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : aiDown ? (
        <Text className="text-sm text-muted-foreground">
          {insights?.error || risk?.error || "AI service chưa hoạt động — khởi động microservice port 8000."}
        </Text>
      ) : (
        <View className="gap-3">
          {risk?.score != null ? (
            <View className="rounded-2xl border p-3" style={{ borderColor: `${riskColor}44`, backgroundColor: `${riskColor}11` }}>
              <Text className="text-xs font-bold text-muted-foreground">Điểm rủi ro</Text>
              <Text className="text-2xl font-extrabold" style={{ color: riskColor }}>
                {risk.score}/100 · {risk.label ?? riskLevel}
              </Text>
            </View>
          ) : null}
          {(insights?.insights ?? []).slice(0, 3).map((item, idx) => (
            <View key={`${item.title}-${idx}`} className="rounded-xl bg-white/5 p-3">
              <Text className="font-bold text-white">{item.title}</Text>
              <Text className="mt-1 text-sm leading-5 text-muted-foreground">{item.detail}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
