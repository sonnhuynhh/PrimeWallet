"""
PrimeWallet AI Microservice — Phân tích chi tiêu & phát hiện gian lận.

Kiến trúc:
- Kafka consumer (background thread) lắng nghe topic "wallet.transactions"
  từ Java backend → lưu vào SQLite
- FraudDetector (Isolation Forest) — persist bằng joblib, retrain tự động
- SpendingAnalyzer — phân loại chi tiêu + sinh insights tiếng Việt

API:
- GET  /                       → health check
- GET  /api/ai/health          → trạng thái service (kafka, model, data)
- GET  /api/ai/users/{uid}/insights      → insights chi tiêu
- GET  /api/ai/users/{uid}/risk-score    → điểm rủi ro 0-100
- GET  /api/ai/users/{uid}/transactions  → giao dịch AI đã thấy
- POST /api/ai/train-fraud-model         → train thủ công (legacy)
- POST /api/ai/detect-fraud              → detect (legacy)
- POST /api/ai/analyze-spending          → phân tích (legacy)

Chạy: uvicorn main:app --host 0.0.0.0 --port 8000
"""
from datetime import datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from services import transaction_store
from services.fraud_detector import FraudDetector
from services.spending_analyzer import SpendingAnalyzer
from services.kafka_consumer import KafkaConsumerService

app = FastAPI(
    title="PrimeWallet AI Microservice",
    description="Dịch vụ AI phân tích chi tiêu và phát hiện gian lận cho PrimeWallet",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== SERVICES ====================
fraud_detector = FraudDetector()
spending_analyzer = SpendingAnalyzer()
kafka_service = KafkaConsumerService(fraud_detector)

# Khởi động Kafka consumer khi app start
@app.on_event("startup")
def on_startup():
    transaction_store.init_db()
    # Train với dữ liệu lịch sử nếu có
    history = transaction_store.get_all_transactions()
    if len(history) >= 10:
        fraud_detector.train(history)
        print(f"[AI] Đã train mô hình với {len(history)} giao dịch lịch sử")
    else:
        print(f"[AI] Chưa đủ dữ liệu lịch sử ({len(history)}), chờ Kafka events")
    kafka_service.start()


@app.on_event("shutdown")
def on_shutdown():
    kafka_service.stop()


# ==================== MODELS ====================
class Transaction(BaseModel):
    id: str
    amount: float
    description: str = ""
    timestamp: str = "2026-01-01T00:00:00"
    currency: str = "VND"
    transactionType: Optional[str] = None


class FraudDetectRequest(BaseModel):
    user_id: str
    transactions: List[Transaction]


class SpendingAnalysisRequest(BaseModel):
    user_id: str
    transactions: List[Transaction]


# ==================== HEALTH ====================
@app.get("/")
def health_check():
    return {
        "status": "ok",
        "service": "PrimeWallet AI Microservice",
        "version": "2.0.0",
        "time": datetime.utcnow().isoformat(),
    }


@app.get("/api/ai/health")
def ai_health():
    """Trạng thái chi tiết: kafka, model, dữ liệu."""
    return {
        "status": "ok",
        "kafka": kafka_service.status,
        "model": {
            "trained": fraud_detector.is_trained,
            "algorithm": "IsolationForest",
        },
        "data": {
            "total_transactions": transaction_store.count_transactions(),
            "total_users": len(transaction_store.get_all_transactions(limit=10000)),
        },
        "time": datetime.utcnow().isoformat(),
    }


# ==================== INSIGHTS ====================
@app.get("/api/ai/users/{user_id}/insights")
def get_insights(user_id: str):
    """Insights chi tiêu tiếng Việt cho user."""
    txs = transaction_store.get_transactions(user_id)
    return spending_analyzer.insights(user_id, txs)


@app.get("/api/ai/users/{user_id}/risk-score")
def get_risk_score(user_id: str):
    """Điểm rủi ro gian lận 0-100."""
    txs = transaction_store.get_transactions(user_id)
    return fraud_detector.risk_score(txs)


@app.get("/api/ai/users/{user_id}/transactions")
def get_ai_transactions(user_id: str, limit: int = 100):
    """Giao dịch AI đã thu thập cho user (audit)."""
    txs = transaction_store.get_transactions(user_id, limit=limit)
    return {
        "user_id": user_id,
        "count": len(txs),
        "transactions": txs,
    }


# ==================== LEGACY API ====================
@app.post("/api/ai/train-fraud-model")
def train_model(request: FraudDetectRequest):
    """Train mô hình với dữ liệu lịch sử (thủ công)."""
    tx_dicts = [
        {
            "id": tx.id,
            "amount": tx.amount,
            "description": tx.description,
            "timestamp": tx.timestamp,
        }
        for tx in request.transactions
    ]
    # Lưu cả vào store nếu chưa có
    for tx in request.transactions:
        transaction_store.save_event({
            "transactionId": tx.id,
            "userId": request.user_id,
            "amount": tx.amount,
            "description": tx.description,
            "timestamp": tx.timestamp,
            "currency": tx.currency,
            "transactionType": tx.transactionType or "UNKNOWN",
        })
    success = fraud_detector.train(tx_dicts)
    if not success:
        return {"status": "failed", "message": "Cần ít nhất 10 giao dịch để train mô hình."}
    return {"status": "success", "message": "Mô hình đã được train thành công."}


@app.post("/api/ai/detect-fraud")
def detect_fraud(request: FraudDetectRequest):
    """Predict các giao dịch bất thường."""
    tx_dicts = [
        {
            "id": tx.id,
            "amount": tx.amount,
            "description": tx.description,
            "timestamp": tx.timestamp,
        }
        for tx in request.transactions
    ]
    detections = fraud_detector.detect_fraud(tx_dicts)
    flagged = [
        {"transaction_id": d["id"], "reason": d["reason"], "score": d["score"]}
        for d in detections
        if d["is_anomaly"]
    ]
    return {
        "anomalies_detected": len(flagged),
        "transactions_flagged": flagged,
    }


@app.post("/api/ai/analyze-spending")
def analyze_spending(request: SpendingAnalysisRequest):
    """Phân tích chi tiêu theo category."""
    tx_dicts = [
        {
            "id": tx.id,
            "amount": tx.amount,
            "description": tx.description,
            "timestamp": tx.timestamp,
        }
        for tx in request.transactions
    ]
    summary = spending_analyzer.analyze_spending(tx_dicts)
    return {
        "user_id": request.user_id,
        "spending_summary": summary["by_category"],
        "total_categories": len(summary["by_category"]),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
