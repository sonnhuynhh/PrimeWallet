"""
FraudDetector — Phát hiện giao dịch bất thường bằng Isolation Forest.

Cải tiến so với bản cũ:
1. Persist mô hình bằng joblib → không mất sau restart
2. Feature engineering tốt hơn: amount, time_diff, hour_of_day, day_of_week
3. Auto-retrain: khi có đủ giao dịch mới, tự train lại
4. Rule-based fallback khi chưa đủ dữ liệu (chưa train)
5. Trả cả điểm bất thường (anomaly score) thay vì chỉ boolean

Score: 0 (bình thường) → 1 (cực kỳ bất thường)
"""
import os
from datetime import datetime

import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
MODEL_PATH = os.path.join(DATA_DIR, "fraud_model.joblib")
MIN_TRAIN_SAMPLES = 10


class FraudDetector:
    def __init__(self):
        self.model = None
        self.is_trained = False
        self._load_model()

    # ==================== PERSISTENCE ====================

    def _load_model(self):
        try:
            if os.path.exists(MODEL_PATH):
                self.model = joblib.load(MODEL_PATH)
                self.is_trained = True
        except Exception as e:
            print(f"[FraudDetector] Không load được model cũ: {e}")
            self.model = None
            self.is_trained = False

    def _save_model(self):
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            joblib.dump(self.model, MODEL_PATH)
        except Exception as e:
            print(f"[FraudDetector] Không lưu được model: {e}")

    # ==================== FEATURES ====================

    @staticmethod
    def _features(transactions: list) -> pd.DataFrame:
        """Chuyển danh sách giao dịch thành DataFrame features."""
        df = pd.DataFrame(transactions)
        if df.empty:
            return pd.DataFrame(columns=["amount", "time_diff_minutes", "hour_of_day", "is_weekend"])

        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        df = df.sort_values("timestamp").dropna(subset=["timestamp"])

        # Sắp xếp giảm dần (mới nhất trước) rồi tính time_diff so với giao dịch kế tiếp
        df = df.iloc[::-1].reset_index(drop=True)
        df["time_diff_minutes"] = df["timestamp"].diff().dt.total_seconds().abs().fillna(1440) / 60.0

        df["hour_of_day"] = df["timestamp"].dt.hour.astype(float)
        df["is_weekend"] = (df["timestamp"].dt.dayofweek >= 5).astype(float)
        df["amount"] = df["amount"].astype(float).abs()

        return df[["amount", "time_diff_minutes", "hour_of_day", "is_weekend"]]

    # ==================== TRAIN ====================

    def train(self, transactions: list) -> bool:
        """Train model với toàn bộ giao dịch lịch sử."""
        if not transactions or len(transactions) < MIN_TRAIN_SAMPLES:
            self.is_trained = False
            return False

        features = self._features(transactions)
        if len(features) < MIN_TRAIN_SAMPLES:
            self.is_trained = False
            return False

        try:
            self.model = IsolationForest(
                contamination=0.05,
                random_state=42,
                n_estimators=120,
                max_samples="auto",
            )
            self.model.fit(features)
            self.is_trained = True
            self._save_model()
            return True
        except Exception as e:
            print(f"[FraudDetector] Train lỗi: {e}")
            self.is_trained = False
            return False

    # ==================== PREDICT ====================

    def detect_fraud(self, recent_transactions: list) -> list:
        """
        Kiểm tra từng giao dịch trong danh sách.
        Trả về list dict: { "id", "is_anomaly": bool, "score": float, "reason": str }
        """
        results = []
        for tx in recent_transactions:
            results.append(self._detect_single(tx, recent_transactions))
        return results

    def _detect_single(self, tx: dict, context: list) -> dict:
        tx_id = tx.get("id") or tx.get("transactionId") or ""
        amount = abs(float(tx.get("amount") or 0))
        currency = tx.get("currency") or "VND"

        # --- Rule-based (luôn chạy, bắt cả khi model chưa train) ---
        rules = []
        if currency in ("VND",) and amount > 50_000_000:
            rules.append("Số tiền rất lớn (> 50 triệu VND)")
        if currency in ("VND",) and amount > 10_000_000 and len(context) <= 2:
            rules.append("Số tiền lớn trong ít giao dịch đầu")

        # Tần suất giao dịch liên tiếp
        try:
            times = [
                datetime.fromisoformat(c.get("timestamp") or "")
                for c in context
                if c.get("timestamp")
            ]
            times.sort()
            # Tìm 2 giao dịch gần nhau nhất chứa tx này
            current_ts = datetime.fromisoformat(tx.get("timestamp") or "")
            diffs = [abs((current_ts - t).total_seconds() / 60.0) for t in times if t != current_ts]
            if diffs and min(diffs) < 1.0:
                rules.append("Nhiều giao dịch trong vòng 1 phút")
        except (ValueError, TypeError):
            pass

        # --- Model-based (nếu đã train) ---
        score = 0.0
        if self.is_trained and self.model is not None:
            try:
                features = self._features([tx])
                if not features.empty:
                    # anomaly score càng thấp (âm) = càng bất thường
                    raw = self.model.decision_function(features)[0]
                    # Map [-0.7..0.1] → [0..1]
                    score = max(0.0, min(1.0, (0.05 - raw) / 0.6))
                    is_anomaly = self.model.predict(features)[0] == -1
                    if is_anomaly:
                        rules.append("Mô hình AI phát hiện hành vi bất thường")
            except Exception:
                pass

        # Fallback nếu chưa train: score dựa trên rule
        if not self.is_trained:
            score = min(1.0, 0.3 * len(rules)) if rules else 0.0

        return {
            "id": tx_id,
            "is_anomaly": bool(rules) or score > 0.7,
            "score": round(score, 4),
            "reason": "; ".join(rules) if rules else "Bình thường",
        }

    # ==================== RISK SCORE ====================

    def risk_score(self, user_transactions: list) -> dict:
        """
        Tính điểm rủi ro tổng hợp 0-100 cho 1 user dựa trên toàn bộ giao dịch.
        - 0-30:  An toàn
        - 30-60: Cần chú ý
        - 60-100: Rủi ro cao
        """
        if not user_transactions:
            return {
                "score": 0,
                "level": "SAFE",
                "label": "An toàn",
                "factors": ["Chưa có dữ liệu giao dịch"],
                "anomalies": 0,
            }

        detections = self.detect_fraud(user_transactions[-50:])
        anomalies = [d for d in detections if d["is_anomaly"]]

        # Các yếu tố
        factors = []

        # 1. Anomaly score trung bình
        avg_score = sum(d["score"] for d in detections) / len(detections) if detections else 0

        # 2. Tần suất giao dịch
        now = datetime.now()
        try:
            last_ts = datetime.fromisoformat(user_transactions[-1]["timestamp"])
            hours_since = max(0.0, (now - last_ts).total_seconds() / 3600.0)
        except (ValueError, TypeError):
            hours_since = 24.0

        # 3. Giá trị giao dịch lớn nhất
        max_amount = max(abs(float(t.get("amount") or 0)) for t in user_transactions)

        component_score = avg_score * 100
        if len(anomalies) > 0:
            component_score += min(30, 15 * len(anomalies))
            factors.append(f"{len(anomalies)} giao dịch bất thường được phát hiện")
        if max_amount > 50_000_000:
            component_score += 10
            factors.append(f"Giao dịch lớn nhất {max_amount:,.0f} VND")
        if hours_since < 1 and len(user_transactions) >= 3:
            component_score += 5
            factors.append("Hoạt động giao dịch rất dày đặc gần đây")

        if not factors and component_score == 0:
            factors.append("Không phát hiện dấu hiệu bất thường")

        score = round(min(100, component_score), 1)

        if score >= 60:
            level, label = "HIGH", "Rủi ro cao"
        elif score >= 30:
            level, label = "MEDIUM", "Cần chú ý"
        else:
            level, label = "SAFE", "An toàn"

        return {
            "score": score,
            "level": level,
            "label": label,
            "factors": factors,
            "anomalies": len(anomalies),
            "model_trained": self.is_trained,
        }
