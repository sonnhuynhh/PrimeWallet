from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from datetime import datetime

from services.fraud_detector import FraudDetector
from services.spending_analyzer import SpendingAnalyzer

app = FastAPI(
    title="PrimeWallet AI Microservice",
    description="Dịch vụ AI phân tích chi tiêu và phát hiện gian lận cho PrimeWallet",
    version="1.0.0"
)

# Initialize AI Services
fraud_detector = FraudDetector()
spending_analyzer = SpendingAnalyzer()

# Models for Request Validation
class Transaction(BaseModel):
    id: str
    amount: float
    description: str
    timestamp: str # ISO Format: 2023-01-01T12:00:00Z
    
class FraudDetectRequest(BaseModel):
    user_id: str
    transactions: List[Transaction]
    
class FraudDetectResponse(BaseModel):
    anomalies_detected: int
    transactions_flagged: List[Dict[str, Any]]

class SpendingAnalysisRequest(BaseModel):
    user_id: str
    transactions: List[Transaction]
    
@app.get("/")
def health_check():
    return {"status": "ok", "message": "PrimeWallet AI is running"}

@app.post("/api/ai/train-fraud-model")
def train_model(request: FraudDetectRequest):
    """
    Train the Isolation Forest model using historical data.
    In a real scenario, this would run on a massive dataset offline.
    """
    tx_dicts = [tx.dict() for tx in request.transactions]
    success = fraud_detector.train(tx_dicts)
    if not success:
        return {"status": "failed", "message": "Cần ít nhất 10 giao dịch để train mô hình."}
    return {"status": "success", "message": "Mô hình đã được train thành công."}

@app.post("/api/ai/detect-fraud", response_model=FraudDetectResponse)
def detect_fraud(request: FraudDetectRequest):
    """
    Predict if the provided recent transactions are fraudulent/anomalous.
    """
    tx_dicts = [tx.dict() for tx in request.transactions]
    is_fraud_list = fraud_detector.detect_fraud(tx_dicts)
    
    flagged = []
    for i, is_fraud in enumerate(is_fraud_list):
        if is_fraud:
            flagged.append({
                "transaction_id": request.transactions[i].id,
                "reason": "Hành vi bất thường (Tần suất cao/Số tiền lớn)"
            })
            
    return FraudDetectResponse(
        anomalies_detected=len(flagged),
        transactions_flagged=flagged
    )

@app.post("/api/ai/analyze-spending")
def analyze_spending(request: SpendingAnalysisRequest):
    """
    Analyze user spending habits and categorize transactions.
    """
    tx_dicts = [tx.dict() for tx in request.transactions]
    summary = spending_analyzer.analyze_spending(tx_dicts)
    return {
        "user_id": request.user_id,
        "spending_summary": summary,
        "total_categories": len(summary)
    }

if __name__ == "__main__":
    import uvicorn
    # Run the API on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
