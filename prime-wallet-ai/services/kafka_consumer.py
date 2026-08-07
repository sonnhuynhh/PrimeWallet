"""
KafkaConsumer — Lắng nghe topic "wallet.transactions" từ Java backend.

Java backend gửi TransactionEvent JSON:
{
  "transactionId": "uuid",
  "userId": "uuid",
  "referenceNumber": "TXN...",
  "transactionType": "TOPUP|WITHDRAW|TRANSFER|CRYPTO_SEND",
  "sourceAccountNumber": "...",
  "destinationAccountNumber": "...",
  "amount": 200000.0,
  "currency": "VND",
  "status": "SUCCESS",
  "description": "...",
  "timestamp": "2026-08-07T10:30:00"
}

Mỗi event → lưu vào SQLite → kích hoạt retrain mô hình nếu đủ dữ liệu.
Chạy trong background thread, tự động reconnect nếu Kafka chưa khởi động.
"""
import json
import threading
import time
from datetime import datetime

from services import transaction_store
from services.fraud_detector import FraudDetector

TOPIC = "wallet.transactions"
BOOTSTRAP_SERVERS = ["localhost:9092"]
GROUP_ID = "prime-ai-group"
RETRAIN_BATCH = 50  # retrain sau mỗi N giao dịch mới


class KafkaConsumerService:
    def __init__(self, fraud_detector: FraudDetector):
        self.fraud_detector = fraud_detector
        self._thread = None
        self._running = False
        self.consumed_count = 0
        self.last_error = None
        self.last_event_at = None
        self._since_retrain = 0

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True, name="kafka-ai-consumer")
        self._thread.start()
        print("[AI] Kafka consumer đã khởi động (thread background)")

    def stop(self):
        self._running = False

    @property
    def status(self) -> dict:
        return {
            "running": self._running,
            "consumed": self.consumed_count,
            "last_event_at": self.last_event_at,
            "last_error": self.last_error,
        }

    def _run(self):
        """Vòng lặp consume — poll chủ động, tự reconnect khi Kafka không có."""
        while self._running:
            try:
                from kafka import KafkaConsumer

                consumer = KafkaConsumer(
                    TOPIC,
                    bootstrap_servers=BOOTSTRAP_SERVERS,
                    group_id=GROUP_ID,
                    auto_offset_reset="earliest",  # đọc từ đầu nếu group mới
                    enable_auto_commit=True,
                    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                )

                self.last_error = None
                print(f"[AI] Kafka consumer kết nối thành công tới {BOOTSTRAP_SERVERS}")

                # Dùng poll(timeout) thay vì for-in để tránh rebalance liên tục
                # khi topic idle (for-in sẽ StopIteration sau mỗi lần timeout)
                while self._running:
                    records = consumer.poll(timeout_ms=1000, max_records=100)
                    for _tp, messages in records.items():
                        for message in messages:
                            self._handle(message.value)
                    if self._running and records:
                        consumer.commit()
            except ImportError:
                self.last_error = "kafka-python chưa được cài đặt. Chạy: pip install kafka-python"
                print(f"[AI] {self.last_error}")
                time.sleep(10)
            except Exception as e:
                self.last_error = str(e)
                print(f"[AI] Kafka consumer lỗi (retry trong 5s): {e}")
                time.sleep(5)

    def _handle(self, event: dict):
        """Xử lý 1 event từ Kafka."""
        if not event or not isinstance(event, dict):
            return
        try:
            tx_id = str(event.get("transactionId") or "")
            user_id = str(event.get("userId") or "")

            # Lưu vào SQLite (idempotent)
            is_new = transaction_store.save_event(event)
            if is_new:
                self.consumed_count += 1
                self.last_event_at = datetime.utcnow().isoformat()
                self._since_retrain += 1

                # Log gọn để dễ debug
                print(
                    f"[AI] Nhận event {event.get('transactionType')} "
                    f"{event.get('amount')} {event.get('currency')} "
                    f"user={user_id[:8]}... tx={tx_id[:8]}..."
                )

                # Retrain định kỳ khi đủ dữ liệu mới
                if self._since_retrain >= RETRAIN_BATCH:
                    self._retrain_global()
                    self._since_retrain = 0
        except Exception as e:
            print(f"[AI] Lỗi xử lý event: {e}")

    def _retrain_global(self):
        """Train lại mô hình với toàn bộ dữ liệu lịch sử (background)."""
        try:
            all_txs = transaction_store.get_all_transactions()
            ok = self.fraud_detector.train(all_txs)
            print(f"[AI] Retrain mô hình: {'OK' if ok else 'Chưa đủ dữ liệu'} "
                  f"({len(all_txs)} giao dịch)")
        except Exception as e:
            print(f"[AI] Retrain lỗi: {e}")

    def retrain(self) -> bool:
        """API gọi thủ công để train lại với toàn bộ dữ liệu."""
        all_txs = transaction_store.get_all_transactions()
        return self.fraud_detector.train(all_txs)
