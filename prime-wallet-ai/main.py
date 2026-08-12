"""
PrimeWallet AI Microservice — Phân tích chi tiêu & phát hiện gian lận.
...
"""
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

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
            "total_users": len(transaction_store.list_user_ids()),
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


@app.get("/api/ai/users/{user_id}/count")
def get_user_tx_count(user_id: str):
    return {"user_id": user_id, "count": transaction_store.count_transactions(user_id)}


@app.get("/api/ai/fraud-report")
def get_fraud_report(min_level: Optional[str] = None, limit: int = 100):
    """
    Báo cáo rủi ro gian lận toàn hệ thống (dành cho Admin).

    min_level: SAFE | MEDIUM | HIGH — chỉ trả user đạt mức tối thiểu
               (HIGH ⊂ MEDIUM ⊂ SAFE theo thứ tự nghiêm trọng).
    """
    level_rank = {"SAFE": 0, "MEDIUM": 1, "HIGH": 2}
    min_rank = level_rank.get((min_level or "SAFE").upper(), 0)
    user_ids = transaction_store.list_user_ids()
    entries = []

    for uid in user_ids:
        txs = transaction_store.get_transactions(uid, limit=200)
        risk = fraud_detector.risk_score(txs)
        level = str(risk.get("level") or "SAFE").upper()
        if level_rank.get(level, 0) < min_rank:
            continue
        entries.append(
            {
                "user_id": uid,
                "transaction_count": len(txs),
                "score": risk.get("score", 0),
                "level": level,
                "label": risk.get("label"),
                "factors": risk.get("factors") or [],
                "anomalies": risk.get("anomalies", 0),
                "model_trained": risk.get("model_trained", False),
            }
        )

    entries.sort(key=lambda e: float(e.get("score") or 0), reverse=True)
    capped = entries[: max(1, min(limit, 500))]

    high = sum(1 for e in entries if e["level"] == "HIGH")
    medium = sum(1 for e in entries if e["level"] == "MEDIUM")
    safe = sum(1 for e in entries if e["level"] == "SAFE")

    return {
        "available": True,
        "model_trained": fraud_detector.is_trained,
        "total_users_scanned": len(user_ids),
        "summary": {
            "high": high,
            "medium": medium,
            "safe": safe,
            "total": len(entries),
        },
        "users": capped,
    }


class IngestEventsRequest(BaseModel):
    events: List[dict]


@app.post("/api/ai/users/{user_id}/ingest")
def ingest_user_events(user_id: str, body: IngestEventsRequest):
    """Đồng bộ giao dịch fiat từ Java backend (khi Kafka/AI khởi động muộn)."""
    ingested = 0
    for event in body.events:
        payload = dict(event)
        payload["userId"] = user_id
        if transaction_store.save_event(payload):
            ingested += 1

    total = transaction_store.count_transactions(user_id)
    all_txs = transaction_store.get_all_transactions()
    if len(all_txs) >= 10:
        fraud_detector.train(all_txs)

    return {"user_id": user_id, "ingested": ingested, "total": total}


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
