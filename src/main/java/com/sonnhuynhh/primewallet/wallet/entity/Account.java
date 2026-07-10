package com.sonnhuynhh.primewallet.wallet.entity;

import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.wallet.enums.AccountStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity đại diện cho tài khoản ví của người dùng.
 *
 * Mỗi User có thể sở hữu nhiều Account (VD: ví VNĐ, ví USDT).
 * Khi User đăng ký thành công, hệ thống sẽ tự động tạo 1 Account mặc định (VNĐ).
 *
 * Trường `balance`:
 * - Đây là Materialized Balance (số dư được lưu trực tiếp, không phải tính SUM mỗi lần).
 * - Được cập nhật TRONG CÙNG DB TRANSACTION với LedgerEntry để đảm bảo tính nhất quán.
 * - Dùng BigDecimal (map NUMERIC(20,4) trong DB) thay vì Double để tránh lỗi làm tròn tài chính.
 * - Constraint CHECK (balance >= 0) ở cấp DB là hàng rào cuối cùng chống số dư âm.
 *
 * Trường `accountNumber`:
 * - Mã ví duy nhất hiển thị cho user (VD: "PW00001234").
 * - Dùng để chuyển tiền thay vì expose UUID nội bộ.
 */
@Entity
@Table(name = "accounts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * Liên kết đến User sở hữu ví này.
     * LAZY loading: Chỉ query User khi cần, không load tự động.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    /**
     * Mã tài khoản ví hiển thị cho user (VD: "PW00001234").
     */
    @Column(name = "account_number", nullable = false, unique = true, length = 20)
    private String accountNumber;

    /**
     * Loại tiền tệ (VND, USDT, ETH, ...).
     */
    @Column(nullable = false, length = 10)
    @Builder.Default
    private String currency = "VND";

    /**
     * Số dư hiện tại (Materialized Balance).
     * Kiểu BigDecimal map sang NUMERIC(20, 4) trong PostgreSQL.
     * precision = 20: tối đa 20 chữ số.
     * scale = 4: 4 chữ số sau dấu phẩy.
     */
    @Column(nullable = false, precision = 20, scale = 4)
    @Builder.Default
    private BigDecimal balance = BigDecimal.ZERO;

    /**
     * Trạng thái ví: ACTIVE, LOCKED, CLOSED.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private AccountStatus status = AccountStatus.ACTIVE;

    /**
     * Loại ví: PRIMARY (ví chính VNĐ), CRYPTO (ví tiền điện tử).
     */
    @Column(name = "account_type", length = 20)
    @Builder.Default
    private String accountType = "PRIMARY";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
