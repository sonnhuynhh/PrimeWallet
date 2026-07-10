package com.sonnhuynhh.primewallet.wallet.repository;

import com.sonnhuynhh.primewallet.wallet.entity.Account;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository truy xuất dữ liệu Account (Tài khoản ví).
 */
@Repository
public interface AccountRepository extends JpaRepository<Account, UUID> {

    /**
     * Tìm tất cả ví của một user.
     * Dùng khi hiển thị danh sách ví trên giao diện.
     */
    List<Account> findByUserId(UUID userId);

    /**
     * Tìm ví theo số tài khoản (VD: "PW00001234").
     * Dùng khi chuyển tiền (người gửi nhập số tài khoản người nhận).
     */
    Optional<Account> findByAccountNumber(String accountNumber);

    /**
     * Tìm ví chính (PRIMARY) của user theo loại tiền tệ.
     * Dùng khi cần lấy ví mặc định (VD: ví VNĐ chính).
     */
    Optional<Account> findByUserIdAndCurrencyAndAccountType(UUID userId, String currency, String accountType);

    /**
     * Tìm ví và KHÓA dòng dữ liệu (Pessimistic Write Lock).
     *
     * Tại sao cần PESSIMISTIC_WRITE?
     * Khi 2 giao dịch đồng thời cùng trừ tiền 1 ví (Race Condition):
     * - Không có lock: Cả 2 đọc balance = 500k, cả 2 trừ 400k → cả 2 thành công
     *   → Balance = 100k thay vì -300k → SAI!
     * - Có PESSIMISTIC_WRITE: Giao dịch 1 khóa dòng → giao dịch 2 phải CHỜ
     *   → Giao dịch 1 trừ xong (100k) → Giao dịch 2 đọc lại (100k) → Thất bại vì không đủ.
     *
     * Đây là SELECT ... FOR UPDATE trong SQL.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT a FROM Account a WHERE a.id = :id")
    Optional<Account> findByIdWithLock(UUID id);

    /**
     * Kiểm tra user đã có ví chưa.
     * Dùng khi đăng ký để tránh tạo ví trùng.
     */
    boolean existsByUserId(UUID userId);
}
