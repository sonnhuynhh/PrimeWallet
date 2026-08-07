package com.sonnhuynhh.primewallet.payment.entity;

import com.sonnhuynhh.primewallet.payment.enums.PaymentOrderStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Đơn thanh toán VNPAY.
 *
 * TẠI SAO CẦN BẢNG NÀY (Fix #16 + #3)?
 * - Trước đây, IPN từ VNPAY được TIN TƯỞNG hoàn toàn: số tiền + userId lấy thẳng
 *   từ callback rồi nạp vào ví. Không có "đơn hàng gốc" để đối chiếu.
 *   → Nếu callback bị sai lệch (bug, replay, lỗi), hệ thống nạp nhầm số tiền.
 * - Khi nghiệp vụ nạp tiền thất bại (tài khoản khóa / chưa KYC) SAU KHI VNPAY đã
 *   thu tiền, code cũ chỉ ghi log rồi trả 00 → TIỀN BIẾN MẤT, không ai biết để xử lý.
 *
 * GIẢI PHÁP:
 * - Lúc tạo URL thanh toán → lưu 1 PaymentOrder (PENDING) với userId + amount kỳ vọng.
 * - Khi nhận IPN → tra cứu đơn theo txnRef, ĐỐI CHIẾU số tiền, lấy userId TỪ ĐƠN
 *   (không tin callback), rồi mới nạp ví.
 * - Nếu nạp thất bại → đánh dấu FAILED + lưu lý do → Admin đối soát tay.
 */
@Entity
@Table(name = "payment_orders", indexes = {
        @Index(name = "idx_payment_orders_txn_ref", columnList = "txn_ref", unique = true),
        @Index(name = "idx_payment_orders_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * Mã giao dịch VNPAY (vnp_TxnRef) — duy nhất. Cũng dùng làm idempotencyKey khi nạp ví.
     */
    @Column(name = "txn_ref", nullable = false, unique = true, length = 64)
    private String txnRef;

    /**
     * User sở hữu đơn (nguồn TIN CẬY cho userId khi nạp ví, thay vì đọc từ callback).
     */
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /**
     * Số tiền kỳ vọng (VNĐ). IPN phải khớp số này mới được nạp.
     */
    @Column(nullable = false, precision = 20, scale = 4)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private PaymentOrderStatus status = PaymentOrderStatus.PENDING;

    /**
     * Lý do thất bại (khi status = FAILED) để Admin đối soát.
     */
    @Column(name = "failure_reason", length = 500)
    private String failureReason;

    /**
     * Mã phản hồi VNPAY (vnp_ResponseCode) ghi lại để tra soát.
     */
    @Column(name = "vnp_response_code", length = 10)
    private String vnpResponseCode;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
