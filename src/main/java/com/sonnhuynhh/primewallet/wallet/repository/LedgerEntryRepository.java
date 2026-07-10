package com.sonnhuynhh.primewallet.wallet.repository;

import com.sonnhuynhh.primewallet.wallet.entity.LedgerEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Repository truy xuất dữ liệu LedgerEntry (Sổ cái).
 */
@Repository
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, UUID> {

    /**
     * Lấy tất cả bút toán của một giao dịch.
     * Dùng khi xem chi tiết giao dịch (ai bị trừ, ai được cộng).
     */
    List<LedgerEntry> findByTransactionId(UUID transactionId);

    /**
     * Lấy lịch sử biến động số dư của một tài khoản (phân trang).
     * Hiển thị trên UI: "Cộng 100k từ Nguyễn Văn A, Số dư: 600k".
     */
    Page<LedgerEntry> findByAccountIdOrderByCreatedAtDesc(UUID accountId, Pageable pageable);

    /**
     * Tính số dư thực tế từ sổ cái (SUM CREDIT - SUM DEBIT).
     *
     * Mục đích: Đối soát (Reconciliation).
     * So sánh kết quả này với account.balance (materialized balance).
     * Nếu 2 giá trị khác nhau → Hệ thống bị lỗi nghiêm trọng, cần điều tra.
     *
     * Query giải thích:
     * - SUM tất cả CREDIT (tiền vào) của tài khoản
     * - TRỪ SUM tất cả DEBIT (tiền ra) của tài khoản
     * - COALESCE: Trả về 0 nếu chưa có giao dịch nào (tránh NULL).
     */
    @Query("SELECT COALESCE(SUM(CASE WHEN le.entryType = 'CREDIT' THEN le.amount ELSE BigDecimal.ZERO END), BigDecimal.ZERO) - " +
           "COALESCE(SUM(CASE WHEN le.entryType = 'DEBIT' THEN le.amount ELSE BigDecimal.ZERO END), BigDecimal.ZERO) " +
           "FROM LedgerEntry le WHERE le.account.id = :accountId")
    BigDecimal calculateBalanceByAccountId(UUID accountId);
}
