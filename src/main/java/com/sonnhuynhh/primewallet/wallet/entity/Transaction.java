package com.sonnhuynhh.primewallet.wallet.entity;

import com.sonnhuynhh.primewallet.wallet.enums.TransactionStatus;
import com.sonnhuynhh.primewallet.wallet.enums.TransactionType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity ghi nhận thông tin tổng quan của một giao dịch tài chính.
 *
 * Mỗi Transaction sẽ tạo ra 1 hoặc 2 dòng LedgerEntry (sổ cái):
 * - Nạp tiền (TOPUP):    1 CREDIT vào ví user.
 * - Rút tiền (WITHDRAW): 1 DEBIT từ ví user.
 * - Chuyển tiền (TRANSFER): 1 DEBIT (trừ ví gửi) + 1 CREDIT (cộng ví nhận).
 *
 * Trường `idempotencyKey`:
 * - Client phải gửi kèm UUID này trong mỗi request giao dịch.
 * - Nếu mạng timeout và client gửi lại (retry), hệ thống phát hiện key đã tồn tại
 *   → trả kết quả cũ mà KHÔNG tạo giao dịch mới.
 * - Đây là cơ chế bắt buộc trong hệ thống tài chính để tránh trừ/cộng tiền 2 lần.
 *
 * Trường `referenceNumber`:
 * - Mã tham chiếu duy nhất hiển thị cho user trên giao diện (VD: "TXN20260711001234").
 * - Khác với UUID (dùng nội bộ), referenceNumber dễ đọc và dùng khi liên hệ hỗ trợ.
 */
@Entity
@Table(name = "transactions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * Khóa chống giao dịch trùng lặp.
     * Client tạo UUID này và gửi kèm request.
     * UNIQUE constraint đảm bảo không có 2 giao dịch cùng key.
     */
    @Column(name = "idempotency_key", nullable = false, unique = true)
    private UUID idempotencyKey;

    /**
     * Mã tham chiếu hiển thị cho user (VD: "TXN20260711001234").
     */
    @Column(name = "reference_number", nullable = false, unique = true, length = 30)
    private String referenceNumber;

    /**
     * Loại giao dịch: TOPUP, WITHDRAW, TRANSFER, PAYMENT.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false, length = 20)
    private TransactionType transactionType;

    /**
     * Tài khoản nguồn (người gửi). NULL nếu là TOPUP (tiền từ ngoài hệ thống vào).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_account_id")
    private Account sourceAccount;

    /**
     * Tài khoản đích (người nhận). NULL nếu là WITHDRAW (tiền ra ngoài hệ thống).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "destination_account_id")
    private Account destinationAccount;

    /**
     * Số tiền giao dịch. Luôn dương (> 0).
     */
    @Column(nullable = false, precision = 20, scale = 4)
    private BigDecimal amount;

    /**
     * Phí giao dịch (nếu có). Mặc định = 0.
     */
    @Column(precision = 20, scale = 4)
    @Builder.Default
    private BigDecimal fee = BigDecimal.ZERO;

    /**
     * Loại tiền tệ của giao dịch.
     */
    @Column(nullable = false, length = 10)
    @Builder.Default
    private String currency = "VND";

    /**
     * Nội dung giao dịch / lý do chuyển tiền.
     */
    @Column(length = 500)
    private String description;

    /**
     * Trạng thái giao dịch: PENDING → SUCCESS / FAILED / REVERSED.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TransactionStatus status = TransactionStatus.PENDING;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
