import { request } from "./http";

export interface AiInsight {
  type: string;
  icon: string;
  title: string;
  detail: string;
}

export interface AiInsightsData {
  available?: boolean;
  error?: string;
  has_data?: boolean;
  message?: string;
  insights?: AiInsight[];
  summary?: Record<string, number>;
}

export interface AiRiskScoreData {
  available?: boolean;
  error?: string;
  score?: number;
  level?: "SAFE" | "MEDIUM" | "HIGH";
  label?: string;
  factors?: string[];
  anomalies?: unknown[];
  model_trained?: boolean;
}

export interface AiHealthData {
  available?: boolean;
  status?: string;
}

/**
 * Lấy insights chi tiêu từ AI service (qua backend Java proxy /api/v1/ai).
 */
export function getAiInsights() {
  return request<AiInsightsData>("/api/v1/ai/insights");
}

/**
 * Lấy điểm rủi ro gian lận từ AI service.
 */
export function getAiRiskScore() {
  return request<AiRiskScoreData>("/api/v1/ai/risk-score");
}

/**
 * Kiểm tra AI service có đang chạy không.
 */
export function getAiHealth() {
  return request<AiHealthData>("/api/v1/ai/health");
}
