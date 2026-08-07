package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.wallet.entity.Account;
import com.sonnhuynhh.primewallet.wallet.entity.LedgerEntry;
import com.sonnhuynhh.primewallet.wallet.entity.Transaction;
import com.sonnhuynhh.primewallet.wallet.enums.EntryType;
import com.sonnhuynhh.primewallet.wallet.repository.AccountRepository;
import com.sonnhuynhh.primewallet.wallet.repository.LedgerEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.Duration;

/**
 * Service ghi nhận bút toán vào sổ cái (Ledger).
 *
 * Đây là lớp quan trọng nhất đảm bảo tính chính xác tài chính.
 * MỌI biến động số dư PHẢI đi qua service này.
 *
 * Nguyên tắc:
 * 1. KHÔNG BAO GIỜ cập nhật account.balance trực tiếp mà không tạo LedgerEntry.
 * 2. LedgerEntry là Immutable (chỉ INSERT, không UPDATE/DELETE).
 * 3. Tổng DEBIT == Tổng CREDIT trên toàn hệ thống (Invariant bất biến).
 *
 * Service này KHÔNG có @Transactional riêng — nó được gọi BÊN TRONG
 * transaction của TransactionService để đảm bảo Atomicity.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LedgerService {

    private final LedgerEntryRepository ledgerEntryRepository;
    private final AccountRepository accountRepository;
    private final RedisTemplate<String, String> redisTemplate;

    /**
     * Prefix cho Redis key.
     * Key format: "account:balance:550e8400-..."
     * Dùng prefix để dễ tìm và xóa hàng loạt khi cần.
     */
    private static final String BALANCE_CACHE_PREFIX = "account:balance:";

    /**
     * Thời gian cache sống (TTL = Time To Live).
     * Sau 30 phút không cập nhật → cache tự hết hạn → lần đọc tiếp query DB.
     * Tại sao 30 phút? → Cân bằng giữa hiệu năng và tính mới của dữ liệu.
     */
    private static final Duration CACHE_TTL = Duration.ofMinutes(30);

    /**
     * Ghi bút toán DEBIT — Trừ tiền khỏi tài khoản.
     *
     * Thực hiện 2 việc trong cùng 1 transaction:
     * 1. Trừ balance của account
     * 2. Tạo LedgerEntry ghi nhận việc trừ tiền
     *
     * @param account     Tài khoản bị trừ tiền (đã được lock bằng PESSIMISTIC_WRITE)
     * @param transaction Giao dịch liên quan
     * @param amount      Số tiền cần trừ
     * @return LedgerEntry vừa tạo
     */
    public LedgerEntry debit(Account account, Transaction transaction, BigDecimal amount) {
        // 1. Tính số dư mới sau khi trừ
        BigDecimal newBalance = account.getBalance().subtract(amount);

        // 2. Cập nhật materialized balance
        account.setBalance(newBalance);
        accountRepository.save(account);

        // 3. Cập nhật Redis cache (write-through)
        updateBalanceCache(account.getId().toString(), newBalance);

        // 4. Tạo bút toán DEBIT trong sổ cái
        LedgerEntry entry = LedgerEntry.builder()
                .transaction(transaction)
                .account(account)
                .entryType(EntryType.DEBIT)
                .amount(amount)
                .balanceAfter(newBalance)
                .build();

        return ledgerEntryRepository.save(entry);
    }

    /**
     * Ghi bút toán CREDIT — Cộng tiền vào tài khoản.
     *
     * Thực hiện 2 việc trong cùng 1 transaction:
     * 1. Cộng balance của account
     * 2. Tạo LedgerEntry ghi nhận việc cộng tiền
     *
     * @param account     Tài khoản được cộng tiền
     * @param transaction Giao dịch liên quan
     * @param amount      Số tiền cần cộng
     * @return LedgerEntry vừa tạo
     */
    public LedgerEntry credit(Account account, Transaction transaction, BigDecimal amount) {
        // 1. Tính số dư mới sau khi cộng
        BigDecimal newBalance = account.getBalance().add(amount);

        // 2. Cập nhật materialized balance
        account.setBalance(newBalance);
        accountRepository.save(account);

        // 3. Cập nhật Redis cache (write-through)
        updateBalanceCache(account.getId().toString(), newBalance);

        // 4. Tạo bút toán CREDIT trong sổ cái
        LedgerEntry entry = LedgerEntry.builder()
                .transaction(transaction)
                .account(account)
                .entryType(EntryType.CREDIT)
                .amount(amount)
                .balanceAfter(newBalance)
                .build();

        return ledgerEntryRepository.save(entry);
    }

    // ==================== REDIS CACHE ====================

    /**
     * Cập nhật số dư trong Redis cache — CHỈ SAU KHI transaction COMMIT thành công.
     *
     * Fix #8 (Cache/DB inconsistency):
     * Trước đây cache được ghi NGAY trong transaction. Nếu sau đó transaction ROLLBACK
     * (VD: transfer đã DEBIT ví gửi rồi CREDIT ví nhận thất bại), DB quay về số cũ
     * nhưng Redis vẫn giữ số SAI trong tối đa 30 phút → user thấy số dư ma.
     *
     * Giải pháp: đăng ký callback afterCommit qua TransactionSynchronizationManager.
     * - Nếu transaction COMMIT → mới ghi Redis (số liệu chắc chắn đúng).
     * - Nếu transaction ROLLBACK → callback KHÔNG chạy → cache không bị nhiễm bẩn
     *   (lần đọc kế tiếp sẽ cache-miss và lấy số đúng từ DB).
     *
     * Nếu đang chạy NGOÀI transaction (hiếm) → ghi luôn để không mất tính năng cache.
     *
     * Redis lỗi → chỉ log warning, KHÔNG throw. Giao dịch tài chính không phụ thuộc cache.
     */
    private void updateBalanceCache(String accountId, BigDecimal newBalance) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    writeBalanceCache(accountId, newBalance);
                }
            });
        } else {
            writeBalanceCache(accountId, newBalance);
        }
    }

    /**
     * Ghi thực tế xuống Redis. Tách riêng để tái sử dụng cho cả 2 nhánh (trong/ngoài transaction).
     */
    private void writeBalanceCache(String accountId, BigDecimal newBalance) {
        try {
            String key = BALANCE_CACHE_PREFIX + accountId;
            redisTemplate.opsForValue().set(key, newBalance.toPlainString(), CACHE_TTL);
            log.debug("Redis cache updated: {} = {}", key, newBalance.toPlainString());
        } catch (Exception e) {
            // Redis lỗi → chỉ log, không ảnh hưởng giao dịch
            log.warn("Không thể cập nhật Redis cache cho account {}: {}",
                    accountId, e.getMessage());
        }
    }
}
