import { request } from "./http";

export interface AiInsight {
  type: string;
  icon: string;
  title: string;
  detail: string;
}

export interface AiInsightsData {
  available?: boolean;
  has_data?: boolean;
  message?: string;
  insights?: AiInsight[];
  summary?: Record<string, number>;
}

export interface AiRiskScoreData {
  available?: boolean;
  score?: number;
  level?: "SAFE" | "MEDIUM" | "HIGH";
  label?: string;
  factors?: string[];
}

export function getAiInsights() {
  return request<AiInsightsData>("/api/v1/ai/insights");
}

export function getAiRiskScore() {
  return request<AiRiskScoreData>("/api/v1/ai/risk-score");
}
