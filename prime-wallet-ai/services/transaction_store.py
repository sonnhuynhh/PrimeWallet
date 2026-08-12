"""
TransactionStore — Lưu trữ giao dịch AI nhận được từ Kafka vào SQLite.

Lý do dùng SQLite thay vì bộ nhớ:
- Bộ nhớ mất sạch khi service restart → AI mất dữ liệu lịch sử → mô hình retrain kém
- SQLite nhẹ, không cần server riêng, đủ cho service phụ trợ
- Mô hình fraud detection cần dữ liệu lịch sử → phải persist

Schema:
  ai_transactions (
    id TEXT PRIMARY KEY,           -- transactionId (UUID từ Java)
    user_id TEXT NOT NULL,
    reference_number TEXT,
    transaction_type TEXT,         -- TOPUP / WITHDRAW / TRANSFER / CRYPTO_SEND
    source_account TEXT,           -- số tài khoản hoặc địa chỉ ví
    destination_account TEXT,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'VND',
    status TEXT,
    description TEXT,
    timestamp TEXT NOT NULL        -- ISO 8601
  )
  ai_user_stats (
    user_id TEXT PRIMARY KEY,
    last_updated TEXT
  )
"""
import json
import os
import sqlite3
import threading
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
DB_PATH = os.path.join(DATA_DIR, "ai.db")
os.makedirs(DATA_DIR, exist_ok=True)

_write_lock = threading.Lock()


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS ai_transactions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                reference_number TEXT,
                transaction_type TEXT,
                source_account TEXT,
                destination_account TEXT,
                amount REAL NOT NULL,
                currency TEXT DEFAULT 'VND',
                status TEXT,
                description TEXT,
                timestamp TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_ai_tx_user ON ai_transactions(user_id);
            CREATE INDEX IF NOT EXISTS idx_ai_tx_time ON ai_transactions(timestamp);

            CREATE TABLE IF NOT EXISTS ai_user_stats (
                user_id TEXT PRIMARY KEY,
                last_updated TEXT
            );
            """
        )


def save_event(event: dict) -> bool:
    """Lưu một event từ Kafka. Trả về True nếu mới (chưa tồn tại)."""
    tx_id = str(event.get("transactionId") or event.get("id") or "")
    if not tx_id:
        return False
    with _write_lock, get_connection() as conn:
        existing = conn.execute(
            "SELECT 1 FROM ai_transactions WHERE id = ?", (tx_id,)
        ).fetchone()
        if existing:
            return False  # idempotent — Kafka có thể gửi lại (at-least-once)
        conn.execute(
            """INSERT OR IGNORE INTO ai_transactions
               (id, user_id, reference_number, transaction_type, source_account,
                destination_account, amount, currency, status, description, timestamp)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (
                tx_id,
                str(event.get("userId") or ""),
                event.get("referenceNumber"),
                event.get("transactionType"),
                event.get("sourceAccountNumber"),
                event.get("destinationAccountNumber"),
                float(event.get("amount") or 0),
                event.get("currency") or "VND",
                event.get("status"),
                event.get("description"),
                event.get("timestamp") or datetime.utcnow().isoformat(),
            ),
        )
        # Upsert user stats
        user_id = str(event.get("userId") or "")
        if user_id:
            conn.execute(
                "INSERT OR REPLACE INTO ai_user_stats (user_id, last_updated) VALUES (?, ?)",
                (user_id, datetime.utcnow().isoformat()),
            )
    return True


def get_transactions(user_id: str = None, limit: int = 1000) -> list:
    """Lấy giao dịch của 1 user (mới nhất trước) hoặc tất cả nếu không có user_id."""
    with get_connection() as conn:
        if user_id:
            rows = conn.execute(
                "SELECT * FROM ai_transactions WHERE user_id = ? ORDER BY timestamp DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM ai_transactions ORDER BY timestamp DESC LIMIT ?", (limit,)
            ).fetchall()
    return [dict(r) for r in rows]


def get_all_transactions(limit: int = 10000) -> list:
    return get_transactions(None, limit)


def count_transactions(user_id: str = None) -> int:
    with get_connection() as conn:
        if user_id:
            return conn.execute(
                "SELECT COUNT(*) FROM ai_transactions WHERE user_id = ?", (user_id,)
            ).fetchone()[0]
        return conn.execute("SELECT COUNT(*) FROM ai_transactions").fetchone()[0]


def list_user_ids() -> list[str]:
    """Danh sách user_id đã có giao dịch trong AI store."""
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT DISTINCT user_id FROM ai_transactions
            WHERE user_id IS NOT NULL AND user_id != ''
            ORDER BY user_id
            """
        ).fetchall()
    return [str(r["user_id"]) for r in rows]


def delete_all():
    with _write_lock, get_connection() as conn:
        conn.execute("DELETE FROM ai_transactions")
        conn.execute("DELETE FROM ai_user_stats")
