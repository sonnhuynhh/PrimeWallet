import { useEffect, useState } from 'react';
import { Sparkles, BrainCircuit, ShieldAlert, ShieldCheck, WifiOff, RefreshCw, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';
import { getAiInsights, getAiRiskScore, type AiInsightsData, type AiRiskScoreData } from '../../services/ai';

/**
 * Bảng AI Insights — hiển thị phân tích chi tiêu + điểm rủi ro gian lận
 * từ AI microservice (thông qua backend Java proxy).
 *
 * Nếu AI service offline → hiển thị trạng thái "unavailable" thay vì lỗi.
 */
export function AiInsightsPanel() {
  const [insights, setInsights] = useState<AiInsightsData | null>(null);
  const [risk, setRisk] = useState<AiRiskScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [i, r] = await Promise.allSettled([getAiInsights(), getAiRiskScore()]);
    setInsights(i.status === 'fulfilled' ? i.value : null);
    setRisk(r.status === 'fulfilled' ? r.value : null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const aiDown =
    (insights === null && risk === null) ||
    insights?.available === false ||
    risk?.available === false;

  const offlineMessage =
    insights?.error ||
    risk?.error ||
    'Khởi động AI microservice (port 8000) để xem phân tích chi tiêu & rủi ro.';

  // ===== Risk score display =====
  const riskScore = risk?.score ?? null;
  const riskLevel = risk?.level ?? null;
  const riskColor =
    riskLevel === 'HIGH' ? 'text-red-400 border-red-500/30 bg-red-500/10'
    : riskLevel === 'MEDIUM' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
    : 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';

  return (
    <Card className="border-violet-500/20 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-violet-500/10 blur-3xl rounded-full" />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <Sparkles className="w-5 h-5 text-violet-400" /> AI Insights
          </h3>
          <button
            onClick={load}
            className="flex items-center gap-1 text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Làm mới
          </button>
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm py-4 text-center">AI đang phân tích...</p>
        ) : aiDown ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <WifiOff className="w-8 h-8 text-slate-500 shrink-0" />
            <div>
              <p className="font-bold text-slate-300 text-sm">AI service chưa hoạt động</p>
              <p className="text-xs text-slate-500">{offlineMessage}</p>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {/* Risk score */}
            <div className={`p-4 rounded-xl border ${riskColor}`}>
              <div className="flex items-center gap-2 mb-2">
                {riskLevel === 'SAFE' ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  <ShieldAlert className="w-5 h-5" />
                )}
                <p className="font-bold text-sm">Điểm rủi ro</p>
              </div>
              {riskScore === null ? (
                <p className="text-sm text-slate-400">Chưa có dữ liệu</p>
              ) : (
                <>
                  <p className="text-3xl font-black">{riskScore}<span className="text-base font-bold text-slate-400">/100</span></p>
                  <p className="text-xs mt-1 font-bold">{risk?.label || riskLevel}</p>
                  {risk?.factors && risk.factors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {risk.factors.slice(0, 3).map((f, i) => (
                        <p key={i} className="text-[11px] text-slate-400">• {f}</p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Insights list */}
            <div className="md:col-span-2 space-y-2">
              {!insights?.has_data || !insights.insights?.length ? (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
                  <TrendingUp className="w-6 h-6 text-slate-500 shrink-0" />
                  <p className="text-sm text-slate-400">
                    {insights?.message || 'Chưa có đủ dữ liệu giao dịch để phân tích.'}
                  </p>
                </div>
              ) : (
                insights.insights.map((ins, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-xl shrink-0">{ins.icon}</span>
                    <div>
                      <p className="text-sm font-bold text-slate-200">{ins.title}</p>
                      <p className="text-xs text-slate-500">{ins.detail}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <p className="mt-3 flex items-center gap-1 text-[11px] text-slate-600">
          <BrainCircuit className="w-3.5 h-3.5" /> Phân tích tự động từ giao dịch của bạn (Isolation Forest + Kafka)
        </p>
      </div>
    </Card>
  );
}
