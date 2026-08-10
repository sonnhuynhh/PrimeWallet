import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { Card } from "../ui/Card";
import { getAiInsights, getAiRiskScore, type AiInsightsData, type AiRiskScoreData } from "../../services/ai";

export function AiInsightsPanel() {
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

  const aiDown = insights === null && risk === null;
  const riskLevel = risk?.level ?? "SAFE";
  const riskColor =
    riskLevel === "HIGH" ? "#fb7185" : riskLevel === "MEDIUM" ? "#fbbf24" : "#4ade80";

  return (
    <Card className="mb-4 gap-3 border border-violet-500/20">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <MaterialCommunityIcons name="creation" size={20} color="#a78bfa" />
          <Text className="text-base font-extrabold text-white">AI Insights</Text>
        </View>
        <Pressable onPress={() => void load()}>
          <Text className="text-xs font-bold text-violet-400">Làm mới</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#a78bfa" />
      ) : aiDown ? (
        <Text className="text-sm text-muted-foreground">
          AI service chưa hoạt động — khởi động microservice port 8000.
        </Text>
      ) : (
        <View className="gap-3">
          {risk?.score != null ? (
            <View className="rounded-2xl border border-border p-3" style={{ borderColor: `${riskColor}44` }}>
              <Text className="text-xs font-bold text-muted-foreground">Điểm rủi ro</Text>
              <Text className="text-2xl font-extrabold" style={{ color: riskColor }}>
                {risk.score}/100 · {risk.label ?? riskLevel}
              </Text>
            </View>
          ) : null}
          {(insights?.insights ?? []).slice(0, 3).map((item, idx) => (
            <View key={`${item.title}-${idx}`} className="rounded-xl bg-white/5 p-3">
              <Text className="font-bold text-white">{item.title}</Text>
              <Text className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
