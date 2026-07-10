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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
public class AccountService {

    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final ReferenceNumberGenerator referenceNumberGenerator;

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
     * Tách riêng method để tái sử dụng.
     */
    private AccountResponse toResponse(Account account) {
        return AccountResponse.builder()
                .id(account.getId())
                .accountNumber(account.getAccountNumber())
                .currency(account.getCurrency())
                .balance(account.getBalance())
                .status(account.getStatus().name())
                .accountType(account.getAccountType())
                .createdAt(account.getCreatedAt())
                .build();
    }
}
