package com.sonnhuynhh.primewallet.notification.service;

import com.sonnhuynhh.primewallet.config.KafkaConfig;
import com.sonnhuynhh.primewallet.wallet.event.TransactionEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

/**
 * Kafka Consumer — Lắng nghe và xử lý thông báo giao dịch.
 *
 * Cách hoạt động:
 * 1. TransactionService publish event lên topic "wallet.transactions"
 * 2. Kafka lưu message trên broker
 * 3. Consumer này tự động nhận message (Spring Kafka quản lý polling)
 * 4. Xử lý: Hiện tại log thông báo, sau này sẽ gửi push notification/email/SMS
 *
 * @KafkaListener là gì?
 * - Annotation của Spring Kafka, đánh dấu method sẽ nhận message từ topic
 * - Spring Boot tự động tạo consumer thread chạy nền
 * - Khi có message mới → Spring gọi method này, truyền event vào parameter
 *
 * Tại sao Consumer TÁCH RIÊNG khỏi TransactionService?
 * - Loose coupling: TransactionService không biết/không cần biết
 *   ai đang lắng nghe event.
 * - Nếu Notification lỗi → KHÔNG ảnh hưởng giao dịch đã hoàn thành
 * - Có thể tắt/bật consumer mà không ảnh hưởng core wallet
 * - Sau này có thể tách thành microservice riêng biệt
 *
 * Consumer Group ID:
 * - Mọi consumer cùng group-id "primewallet-group" sẽ chia nhau message
 * - Mỗi message chỉ được XỬ LÝ 1 LẦN trong cùng group
 * - Nếu cần service khác cũng nhận message → tạo group-id mới
 *   (VD: "ai-fraud-group" cho AI service)
 */
@Service
@Slf4j
public class NotificationConsumer {

    /**
     * Nhận và xử lý event giao dịch từ Kafka.
     *
     * @param event TransactionEvent — Spring Kafka tự deserialize JSON → Object
     *
     * Hiện tại: Log thông báo chi tiết theo loại giao dịch.
     * Tương lai: Gửi push notification (Firebase), email (SendGrid), SMS (Twilio).
     */
    @KafkaListener(
            topics = KafkaConfig.TRANSACTION_TOPIC,
            groupId = "primewallet-group"
    )
    public void handleTransactionEvent(TransactionEvent event) {
        log.info("═══════════════════════════════════════");
        log.info("📨 NHẬN EVENT GIAO DỊCH TỪ KAFKA");
        log.info("═══════════════════════════════════════");

        switch (event.getTransactionType()) {
            case "TOPUP" -> handleTopUp(event);
            case "WITHDRAW" -> handleWithdraw(event);
            case "TRANSFER" -> handleTransfer(event);
            default -> log.warn("Loại giao dịch không xác định: {}", event.getTransactionType());
        }

        log.info("═══════════════════════════════════════");
    }

    /**
     * Xử lý thông báo nạp tiền.
     * Gửi cho: Chủ tài khoản (người nạp)
     */
    private void handleTopUp(TransactionEvent event) {
        log.info("💰 NẠP TIỀN: {} {} vào ví {}",
                event.getAmount(), event.getCurrency(),
                event.getDestinationAccountNumber());
        log.info("📋 Mã giao dịch: {}", event.getReferenceNumber());
        log.info("📝 Nội dung: {}", event.getDescription());

        // TODO: Gửi push notification cho user
        // firebaseService.sendNotification(userId, "Nạp tiền thành công", message);

        // TODO: Gửi email xác nhận
        // emailService.sendTopUpConfirmation(userEmail, event);
    }

    /**
     * Xử lý thông báo rút tiền.
     * Gửi cho: Chủ tài khoản (người rút)
     */
    private void handleWithdraw(TransactionEvent event) {
        log.info("🏧 RÚT TIỀN: {} {} từ ví {}",
                event.getAmount(), event.getCurrency(),
                event.getSourceAccountNumber());
        log.info("📋 Mã giao dịch: {}", event.getReferenceNumber());

        // TODO: Gửi push notification
        // TODO: Gửi email xác nhận
    }

    /**
     * Xử lý thông báo chuyển tiền.
     * Gửi cho: CẢ NGƯỜI GỬI và NGƯỜI NHẬN
     */
    private void handleTransfer(TransactionEvent event) {
        log.info("💸 CHUYỂN TIỀN: {} {} từ {} → {}",
                event.getAmount(), event.getCurrency(),
                event.getSourceAccountNumber(),
                event.getDestinationAccountNumber());
        log.info("📋 Mã giao dịch: {}", event.getReferenceNumber());
        log.info("📝 Nội dung: {}", event.getDescription());

        // TODO: Gửi push notification cho NGƯỜI GỬI
        // "Bạn đã chuyển 200.000đ cho PW00005678"

        // TODO: Gửi push notification cho NGƯỜI NHẬN
        // "Bạn nhận 200.000đ từ PW00001234. Nội dung: Tiền ăn trưa"
    }
}
