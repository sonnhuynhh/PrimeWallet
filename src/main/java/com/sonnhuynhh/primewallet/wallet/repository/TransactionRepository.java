package com.sonnhuynhh.primewallet.wallet.repository;

import com.sonnhuynhh.primewallet.wallet.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Repository truy xuất dữ liệu Transaction (Giao dịch).
 */
@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    /**
     * Tìm giao dịch theo idempotency key.
     * Dùng để kiểm tra giao dịch đã tồn tại chưa trước khi tạo mới.
     * Nếu đã tồn tại → trả kết quả cũ, không xử lý lại.
     */
    Optional<Transaction> findByIdempotencyKey(UUID idempotencyKey);

    /**
     * Lấy lịch sử giao dịch của một tài khoản (cả gửi và nhận).
     * Sử dụng Pageable để phân trang (không load hết 1 lần).
     *
     * Query: Lấy tất cả giao dịch mà account là nguồn HOẶC đích.
     * ORDER BY createdAt DESC: Giao dịch mới nhất hiển thị trước.
     */
    @Query("SELECT t FROM Transaction t WHERE t.sourceAccount.id = :accountId OR t.destinationAccount.id = :accountId ORDER BY t.createdAt DESC")
    Page<Transaction> findByAccountId(UUID accountId, Pageable pageable);

    /**
     * Tìm giao dịch theo mã tham chiếu.
     * Dùng khi user tìm kiếm giao dịch bằng mã hiển thị trên giao diện.
     */
    Optional<Transaction> findByReferenceNumber(String referenceNumber);

    /**
     * Tính tổng số tiền giao dịch theo loại, trạng thái và khoảng thời gian.
     */
    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.transactionType = :type AND t.status = :status AND t.createdAt >= :startDate AND t.createdAt < :endDate")
    java.math.BigDecimal sumAmountByTypeAndStatusAndDate(
            @org.springframework.data.repository.query.Param("type") com.sonnhuynhh.primewallet.wallet.enums.TransactionType type,
            @org.springframework.data.repository.query.Param("status") com.sonnhuynhh.primewallet.wallet.enums.TransactionStatus status,
            @org.springframework.data.repository.query.Param("startDate") java.time.LocalDateTime startDate,
            @org.springframework.data.repository.query.Param("endDate") java.time.LocalDateTime endDate
    );
}
