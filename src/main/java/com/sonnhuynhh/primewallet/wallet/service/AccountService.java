package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import com.sonnhuynhh.primewallet.common.util.ReferenceNumberGenerator;
import com.sonnhuynhh.primewallet.wallet.dto.AccountResponse;
import com.sonnhuynhh.primewallet.wallet.entity.Account;
import com.sonnhuynhh.primewallet.wallet.enums.AccountStatus;
import com.sonnhuynhh.primewallet.wallet.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service quản lý tài khoản ví.
 *
 * Chức năng:
 * - Tạo ví mặc định khi user đăng ký
 * - Lấy thông tin ví
 * - Lấy danh sách tất cả ví của user
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AccountService {

    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final ReferenceNumberGenerator referenceNumberGenerator;
    private final RedisTemplate<String, String> redisTemplate;

    private static final String BALANCE_CACHE_PREFIX = "account:balance:";

    // ==================== TẠO VÍ ====================

    /**
     * Tạo ví VNĐ mặc định cho user mới.
     *
     * Được gọi sau khi đăng ký thành công.
     * Mỗi user chỉ có 1 ví PRIMARY VNĐ.
     */
    @Transactional
    public AccountResponse createDefaultAccount(UUID userId) {
        // 1. Kiểm tra user tồn tại
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

        // 2. Kiểm tra đã có ví chưa (tránh tạo trùng)
        if (accountRepository.existsByUserId(userId)) {
            throw new IllegalStateException("Người dùng đã có ví");
        }

        // 3. Tạo ví mới
        Account account = Account.builder()
                .user(user)
                .accountNumber(referenceNumberGenerator.generateAccountNumber())
                .currency("VND")
                .accountType("PRIMARY")
                .status(AccountStatus.ACTIVE)
                .build();

        account = accountRepository.save(account);

        return toResponse(account);
    }

    // ==================== XEM VÍ ====================

    /**
     * Lấy thông tin ví theo ID.
     */
    @Transactional(readOnly = true)
    public AccountResponse getAccountById(UUID accountId) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ví"));
        return toResponse(account);
    }

    /**
     * Lấy ví chính (PRIMARY VNĐ) của user hiện tại.
     * Đây là ví được dùng mặc định cho mọi giao dịch.
     */
    @Transactional(readOnly = true)
    public AccountResponse getMyPrimaryAccount(UUID userId) {
        Account account = accountRepository
                .findByUserIdAndCurrencyAndAccountType(userId, "VND", "PRIMARY")
                .orElseThrow(() -> new ResourceNotFoundException("Chưa có ví. Vui lòng tạo ví trước."));
        return toResponse(account);
    }

    /**
     * Lấy danh sách tất cả ví của user.
     */
    @Transactional(readOnly = true)
    public List<AccountResponse> getMyAccounts(UUID userId) {
        List<Account> accounts = accountRepository.findByUserId(userId);
        return accounts.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ==================== HELPER ====================

    /**
     * Chuyển Entity → Response DTO.
     *
     * Chiến lược đọc số dư (Cache-Aside Pattern):
     * 1. Kiểm tra Redis có key "account:balance:{id}" không
     * 2. Nếu CÓ (Cache Hit) → dùng số dư từ Redis (~0.1ms)
     * 3. Nếu KHÔNG (Cache Miss) → dùng số dư từ DB entity (~5-10ms)
     *
     * Khi nào cache miss?
     * - Lần đầu tiên truy vấn sau khi tạo ví
     * - Cache hết hạn (TTL 30 phút)
     * - Redis bị restart
     */
    private AccountResponse toResponse(Account account) {
        BigDecimal balance = account.getBalance();

        // Thử đọc số dư từ Redis cache
        try {
            String cachedBalance = redisTemplate.opsForValue()
                    .get(BALANCE_CACHE_PREFIX + account.getId().toString());
            if (cachedBalance != null) {
                balance = new BigDecimal(cachedBalance);
                log.debug("Balance đọc từ Redis cache: {} = {}",
                        account.getAccountNumber(), cachedBalance);
            }
        } catch (Exception e) {
            // Redis lỗi → dùng balance từ DB (fallback an toàn)
            log.warn("Không thể đọc Redis cache, dùng DB balance: {}", e.getMessage());
        }

        return AccountResponse.builder()
                .id(account.getId())
                .accountNumber(account.getAccountNumber())
                .currency(account.getCurrency())
                .balance(balance)
                .status(account.getStatus().name())
                .accountType(account.getAccountType())
                .createdAt(account.getCreatedAt())
                .build();
    }
}
