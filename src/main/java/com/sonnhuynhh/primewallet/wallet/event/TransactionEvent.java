package com.sonnhuynhh.primewallet.wallet.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Event DTO — "Phong bì" chứa thông tin giao dịch gửi qua Kafka.
 *
 * Khi TransactionService xử lý xong giao dịch, nó tạo object này
 * và gửi lên Kafka topic "wallet.transactions".
 *
 * Tại sao KHÔNG gửi Entity Transaction trực tiếp?
 * 1. Entity có quan hệ phức tạp (Account → User → ...) → serialize lỗi (circular reference)
 * 2. Consumer (Python AI, Notification) không cần biết cấu trúc DB
 * 3. Nếu Entity thay đổi cột → Consumer bị ảnh hưởng. Event DTO là "hợp đồng" ổn định.
 *
 * Nguyên tắc thiết kế Event:
 * - Chỉ chứa dữ liệu CẦN THIẾT cho consumer xử lý
 * - Immutable (không thay đổi sau khi tạo)
 * - Có timestamp để biết event xảy ra lúc nào
 * - Serializable thành JSON (Kafka gửi message dưới dạng byte[])
 *
 * Ví dụ JSON khi gửi qua Kafka:
 * {
 *   "transactionId": "550e8400-e29b-41d4-a716-446655440000",
 *   "referenceNumber": "TXN20260711123456",
 *   "transactionType": "TRANSFER",
 *   "sourceAccountNumber": "PW00001234",
 *   "destinationAccountNumber": "PW00005678",
 *   "amount": 200000.0000,
 *   "currency": "VND",
 *   "status": "SUCCESS",
 *   "description": "Tiền ăn trưa",
 *   "timestamp": "2026-07-11T10:30:00"
 * }
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionEvent {

    /**
     * ID giao dịch — dùng làm key khi gửi Kafka message.
     * Kafka dùng key để quyết định message đi vào partition nào.
     * Cùng transactionId → cùng partition → đảm bảo thứ tự.
     */
    private UUID transactionId;

    /**
     * Mã giao dịch hiển thị cho user (VD: "TXN20260711123456").
     */
    private String referenceNumber;

    /**
     * Loại giao dịch: TOPUP, WITHDRAW, TRANSFER, PAYMENT
     */
    private String transactionType;

    /**
     * Số tài khoản ví gửi (null nếu là TOPUP — tiền từ ngoài vào).
     */
    private String sourceAccountNumber;

    /**
     * Số tài khoản ví nhận (null nếu là WITHDRAW — tiền ra ngoài).
     */
    private String destinationAccountNumber;

    /**
     * Số tiền giao dịch.
     */
    private BigDecimal amount;

    /**
     * Loại tiền tệ (VND, USD, ...).
     */
    private String currency;

    /**
     * Trạng thái giao dịch: SUCCESS, FAILED, ...
     */
    private String status;

    /**
     * Nội dung giao dịch do user nhập.
     */
    private String description;

    /**
     * Thời điểm giao dịch xảy ra.
     * Consumer dùng timestamp này để biết event cũ hay mới.
     */
    private String timestamp;
}
