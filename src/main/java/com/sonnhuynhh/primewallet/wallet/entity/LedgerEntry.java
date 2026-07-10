package com.sonnhuynhh.primewallet.wallet.entity;

import com.sonnhuynhh.primewallet.wallet.enums.EntryType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Entity sổ cái (Ledger) — Trái tim của mô hình Ghi sổ kép (Double-Entry).
 *
 * MỌI biến động số dư trong hệ thống đều phải đi qua bảng này.
 * Không bao giờ cập nhật balance trực tiếp mà không ghi ledger entry.
 *
 * Quy tắc:
 * 1. Mỗi Transaction tạo ra ít nhất 1 cặp (DEBIT + CREDIT).
 * 2. Tổng DEBIT == Tổng CREDIT trên toàn hệ thống (Invariant bất biến).
 * 3. Số dư = SUM(CREDIT) - SUM(DEBIT) cho từng tài khoản.
 * 4. Dữ liệu ledger KHÔNG BAO GIỜ được sửa hoặc xóa (Immutable/Append-only).
 *    Nếu cần hoàn tiền → tạo giao dịch đảo ngược (REVERSED), không xóa bản gốc.
 *
 * Trường `balanceAfter`:
 * - Snapshot số dư của tài khoản SAU KHI bút toán này được ghi.
 * - Dùng để đối soát nhanh và hiển thị lịch sử biến động số dư cho user.
 * - VD: Số dư trước = 500k, DEBIT 100k → balanceAfter = 400k.
 *
 * Ví dụ minh họa — User A (500k) chuyển 100k cho User B (500k):
 * | transaction_id | account  | entry_type | amount  | balance_after |
 * |----------------|----------|------------|---------|---------------|
 * | TXN-001        | User A   | DEBIT      | 100,000 | 400,000       |
 * | TXN-001        | User B   | CREDIT     | 100,000 | 600,000       |
 */
@Entity
@Table(name = "ledger_entries")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LedgerEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * Giao dịch mà bút toán này thuộc về.
     * Một Transaction có thể có nhiều LedgerEntry (VD: chuyển tiền = 2 entries).
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", nullable = false)
    private Transaction transaction;

    /**
     * Tài khoản bị biến động số dư.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", nullable = false)
    private Account account;

    /**
     * Loại bút toán: DEBIT (trừ tiền) hoặc CREDIT (cộng tiền).
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type", nullable = false, length = 10)
    private EntryType entryType;

    /**
     * Số tiền biến động. Luôn dương (> 0).
     * Hướng biến động (trừ hay cộng) được xác định bởi entryType.
     */
    @Column(nullable = false, precision = 20, scale = 4)
    private BigDecimal amount;

    /**
     * Số dư tài khoản SAU KHI bút toán này được ghi nhận.
     * Snapshot dùng cho đối soát và hiển thị lịch sử.
     */
    @Column(name = "balance_after", nullable = false, precision = 20, scale = 4)
    private BigDecimal balanceAfter;

    /**
     * Bút toán chỉ ghi 1 lần, không bao giờ sửa (Immutable).
     */
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
