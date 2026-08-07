package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.auth.entity.KycStatus;
import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.exception.*;
import com.sonnhuynhh.primewallet.common.service.AuditService;
import com.sonnhuynhh.primewallet.common.util.ReferenceNumberGenerator;
import com.sonnhuynhh.primewallet.wallet.dto.*;
import com.sonnhuynhh.primewallet.wallet.event.TransactionEvent;
import com.sonnhuynhh.primewallet.wallet.event.TransactionEventPublisher;
import com.sonnhuynhh.primewallet.wallet.entity.Account;
import com.sonnhuynhh.primewallet.wallet.entity.Transaction;
import com.sonnhuynhh.primewallet.wallet.enums.AccountStatus;
import com.sonnhuynhh.primewallet.wallet.enums.TransactionStatus;
import com.sonnhuynhh.primewallet.wallet.enums.TransactionType;
import com.sonnhuynhh.primewallet.wallet.repository.AccountRepository;
import com.sonnhuynhh.primewallet.wallet.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Service xử lý toàn bộ logic giao dịch tài chính.
 *
 * Đây là service QUAN TRỌNG NHẤT trong hệ thống ví điện tử.
 * Mọi thao tác liên quan đến tiền đều đi qua đây.
 *
 * 3 chức năng chính:
 * 1. Nạp tiền (Top Up):    Tiền từ ngoài → vào ví
 * 2. Rút tiền (Withdraw):  Tiền từ ví → ra ngoài
 * 3. Chuyển tiền (Transfer): Tiền từ ví A → ví B
 *
 * Nguyên tắc an toàn:
 * - Mỗi method giao dịch đều chạy trong @Transactional
 *   → Nếu bất kỳ bước nào fail → ROLLBACK toàn bộ → Tiền không bị mất
 * - Idempotency Key chống giao dịch trùng
 * - Pessimistic Lock chống Race Condition
 * - Double-Entry Ledger đảm bảo đối soát chính xác
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final LedgerService ledgerService;
    private final ReferenceNumberGenerator referenceNumberGenerator;
    private final TransactionEventPublisher eventPublisher;
    private final AuditService auditService;

    /**
     * Ngưỡng giao dịch yêu cầu KYC: 10 triệu VNĐ.
     * Giao dịch > ngưỡng này mà user chưa KYC → bị từ chối.
     */
    private static final BigDecimal KYC_THRESHOLD = new BigDecimal("10000000");

    // ==================== NẠP TIỀN (TOP UP) ====================

    /**
     * Nạp tiền vào ví.
     *
     * Luồng xử lý:
     * 1. Kiểm tra idempotency (giao dịch đã tồn tại chưa?)
     * 2. Lấy ví của user (VNĐ PRIMARY)
     * 3. Tạo Transaction (status = PENDING)
     * 4. Ghi sổ: 1 bút toán CREDIT (cộng tiền vào ví)
     * 5. Cập nhật Transaction status = SUCCESS
     *
     * Nạp tiền chỉ tạo 1 CREDIT (không có DEBIT) vì tiền đến từ
     * nguồn bên ngoài hệ thống (ngân hàng).
     */
    @Transactional
    public TransactionResponse topUp(TopUpRequest request, UUID userId) {
        // 1. Kiểm tra idempotency — nếu giao dịch đã tồn tại, trả kết quả cũ
        Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(request.getIdempotencyKey());
        if (existing.isPresent()) {
            log.warn("Giao dịch trùng lặp với idempotency key: {}", request.getIdempotencyKey());
            return toResponse(existing.get());
        }

        // 2. Kiểm tra user có bị khóa hoặc cần KYC không
        validateUserForTransaction(userId, request.getAmount());

        // 3. Lấy ví chính của user
        Account account = accountRepository
                .findByUserIdAndCurrencyAndAccountType(userId, "VND", "PRIMARY")
                .orElseThrow(() -> new ResourceNotFoundException("Chưa có ví. Vui lòng tạo ví trước."));

        // 4. Kiểm tra ví có đang hoạt động không
        validateAccountActive(account);

        // 4. Tạo Transaction (TOPUP)
        Transaction transaction = Transaction.builder()
                .idempotencyKey(request.getIdempotencyKey())
                .referenceNumber(referenceNumberGenerator.generateTransactionReference())
                .transactionType(TransactionType.TOPUP)
                .destinationAccount(account) // Tiền VÀO ví này
                .amount(request.getAmount())
                .currency("VND")
                .description(request.getDescription() != null ? request.getDescription() : "Nạp tiền vào ví")
                .status(TransactionStatus.PENDING)
                .build();
        transaction = transactionRepository.save(transaction);

        // 5. Ghi sổ: CREDIT (cộng tiền vào ví)
        ledgerService.credit(account, transaction, request.getAmount());

        // 6. Cập nhật trạng thái giao dịch
        transaction.setStatus(TransactionStatus.SUCCESS);
        transaction = transactionRepository.save(transaction);

        // 7. Phát event lên Kafka — các consumer sẽ xử lý thông báo, cache, ...
        eventPublisher.publish(buildEvent(transaction, userId));

        log.info("Nạp tiền thành công: {} VNĐ vào ví {}", request.getAmount(), account.getAccountNumber());

        // 8. Ghi audit log
        auditService.log(userId, "TOPUP",
                String.format("Nạp %s VNĐ vào ví %s", request.getAmount(), account.getAccountNumber()), null);

        return toResponse(transaction);
    }

    // ==================== RÚT TIỀN (WITHDRAW) ====================

    /**
     * Rút tiền từ ví.
     *
     * Luồng xử lý:
     * 1. Kiểm tra idempotency
     * 2. Lấy ví và KHÓA (Pessimistic Lock) — chống Race Condition
     * 3. Kiểm tra số dư >= số tiền rút
     * 4. Tạo Transaction (WITHDRAW)
     * 5. Ghi sổ: 1 bút toán DEBIT (trừ tiền từ ví)
     * 6. Cập nhật Transaction status = SUCCESS
     */
    @Transactional
    public TransactionResponse withdraw(WithdrawRequest request, UUID userId) {
        // 1. Kiểm tra idempotency
        Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(request.getIdempotencyKey());
        if (existing.isPresent()) {
            log.warn("Giao dịch trùng lặp với idempotency key: {}", request.getIdempotencyKey());
            return toResponse(existing.get());
        }

        // 2. Kiểm tra user có bị khóa hoặc cần KYC không
        validateUserForTransaction(userId, request.getAmount());

        // 3. Lấy ví chính của user
        Account account = accountRepository
                .findByUserIdAndCurrencyAndAccountType(userId, "VND", "PRIMARY")
                .orElseThrow(() -> new ResourceNotFoundException("Chưa có ví. Vui lòng tạo ví trước."));

        // 4. Khóa ví (Pessimistic Lock) — đảm bảo không ai khác đang trừ tiền đồng thời
        account = accountRepository.findByIdWithLock(account.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ví"));

        // 5. Kiểm tra trạng thái ví
        validateAccountActive(account);

        // 5. Kiểm tra số dư
        if (account.getBalance().compareTo(request.getAmount()) < 0) {
            throw new InsufficientBalanceException(
                    String.format("Số dư không đủ. Hiện có: %s VNĐ, cần: %s VNĐ",
                            account.getBalance(), request.getAmount()));
        }

        // 6. Tạo Transaction (WITHDRAW)
        Transaction transaction = Transaction.builder()
                .idempotencyKey(request.getIdempotencyKey())
                .referenceNumber(referenceNumberGenerator.generateTransactionReference())
                .transactionType(TransactionType.WITHDRAW)
                .sourceAccount(account) // Tiền RA khỏi ví này
                .amount(request.getAmount())
                .currency("VND")
                .description(request.getDescription() != null ? request.getDescription() : "Rút tiền từ ví")
                .status(TransactionStatus.PENDING)
                .build();
        transaction = transactionRepository.save(transaction);

        // 7. Ghi sổ: DEBIT (trừ tiền từ ví)
        ledgerService.debit(account, transaction, request.getAmount());

        // 8. Cập nhật trạng thái
        transaction.setStatus(TransactionStatus.SUCCESS);
        transaction = transactionRepository.save(transaction);

        // 9. Phát event lên Kafka
        eventPublisher.publish(buildEvent(transaction, userId));

        log.info("Rút tiền thành công: {} VNĐ từ ví {}", request.getAmount(), account.getAccountNumber());

        // 10. Ghi audit log
        auditService.log(userId, "WITHDRAW",
                String.format("Rút %s VNĐ từ ví %s", request.getAmount(), account.getAccountNumber()), null);

        return toResponse(transaction);
    }

    // ==================== CHUYỂN TIỀN (TRANSFER) ====================

    /**
     * Chuyển tiền nội bộ giữa 2 ví PrimeWallet.
     *
     * ĐÂY LÀ PHẦN PHỨC TẠP NHẤT — Áp dụng đầy đủ Double-Entry Bookkeeping.
     *
     * Luồng xử lý:
     * 1. Kiểm tra idempotency
     * 2. Lấy ví gửi + KHÓA (Pessimistic Lock)
     * 3. Tìm ví nhận theo số tài khoản
     * 4. Validate: ví gửi ≠ ví nhận, đủ số dư, cả 2 ví đều ACTIVE
     * 5. Tạo Transaction (TRANSFER)
     * 6. Ghi sổ kép:
     *    - DEBIT  ví gửi  (trừ tiền)
     *    - CREDIT ví nhận  (cộng tiền)
     * 7. Cập nhật Transaction status = SUCCESS
     *
     * Tất cả trong 1 @Transactional → ROLLBACK toàn bộ nếu bất kỳ bước nào fail.
     */
    @Transactional
    public TransactionResponse transfer(TransferRequest request, UUID userId) {
        // 1. Kiểm tra idempotency
        Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(request.getIdempotencyKey());
        if (existing.isPresent()) {
            log.warn("Giao dịch trùng lặp với idempotency key: {}", request.getIdempotencyKey());
            return toResponse(existing.get());
        }

        // 2. Kiểm tra user có bị khóa hoặc cần KYC không
        validateUserForTransaction(userId, request.getAmount());

        // 3. Lấy ví gửi (ví chính VNĐ của user hiện tại) — chưa khóa, chỉ để lấy ID
        Account sourceRef = accountRepository
                .findByUserIdAndCurrencyAndAccountType(userId, "VND", "PRIMARY")
                .orElseThrow(() -> new ResourceNotFoundException("Chưa có ví. Vui lòng tạo ví trước."));

        // 4. Tìm ví nhận theo số tài khoản — chưa khóa, chỉ để lấy ID
        Account destRef = accountRepository.findByAccountNumber(request.getDestinationAccountNumber())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy ví nhận với số tài khoản: " + request.getDestinationAccountNumber()));

        // 5. Không cho chuyển cho chính mình
        if (sourceRef.getId().equals(destRef.getId())) {
            throw new IllegalArgumentException("Không thể chuyển tiền cho chính mình");
        }

        // 6. KHÓA CẢ 2 VÍ (CRITICAL FIX #2)
        //    - Trước đây chỉ khóa ví gửi → ví nhận bị Race Condition (mất tiền CREDIT).
        //    - Khóa theo THỨ TỰ ID CỐ ĐỊNH (UUID nhỏ trước) để tránh DEADLOCK
        //      khi 2 giao dịch A→B và B→A chạy đồng thời.
        Account sourceAccount;
        Account destAccount;
        if (sourceRef.getId().compareTo(destRef.getId()) < 0) {
            sourceAccount = lockAccount(sourceRef.getId(), "ví gửi");
            destAccount = lockAccount(destRef.getId(), "ví nhận");
        } else {
            destAccount = lockAccount(destRef.getId(), "ví nhận");
            sourceAccount = lockAccount(sourceRef.getId(), "ví gửi");
        }

        // 7. Validate trạng thái ví (sau khi đã khóa và đọc số dư mới nhất)
        validateAccountActive(sourceAccount);
        validateAccountActive(destAccount);

        if (sourceAccount.getBalance().compareTo(request.getAmount()) < 0) {
            throw new InsufficientBalanceException(
                    String.format("Số dư không đủ. Hiện có: %s VNĐ, cần: %s VNĐ",
                            sourceAccount.getBalance(), request.getAmount()));
        }

        // 8. Tạo Transaction (TRANSFER)
        Transaction transaction = Transaction.builder()
                .idempotencyKey(request.getIdempotencyKey())
                .referenceNumber(referenceNumberGenerator.generateTransactionReference())
                .transactionType(TransactionType.TRANSFER)
                .sourceAccount(sourceAccount)      // Tiền RA khỏi ví gửi
                .destinationAccount(destAccount)   // Tiền VÀO ví nhận
                .amount(request.getAmount())
                .currency("VND")
                .description(request.getDescription() != null ? request.getDescription() : "Chuyển tiền")
                .status(TransactionStatus.PENDING)
                .build();
        transaction = transactionRepository.save(transaction);

        // 9. GHI SỔ KÉP (Double-Entry) — Đây là bước quan trọng nhất!
        //    Bước 9a: DEBIT ví gửi (trừ tiền)
        ledgerService.debit(sourceAccount, transaction, request.getAmount());
        //    Bước 9b: CREDIT ví nhận (cộng tiền)
        ledgerService.credit(destAccount, transaction, request.getAmount());

        // 10. Cập nhật trạng thái
        transaction.setStatus(TransactionStatus.SUCCESS);
        transaction = transactionRepository.save(transaction);

// 11. Phát event lên Kafka
        eventPublisher.publish(buildEvent(transaction, userId));

        log.info("Chuyển tiền thành công: {} VNĐ từ {} → {}",
                request.getAmount(), sourceAccount.getAccountNumber(), destAccount.getAccountNumber());

        // 12. Ghi audit log
        auditService.log(userId, "TRANSFER",
                String.format("Chuyển %s VNĐ từ %s → %s",
                        request.getAmount(), sourceAccount.getAccountNumber(), destAccount.getAccountNumber()), null);

        return toResponse(transaction);
    }

    /**
     * Khóa một ví bằng Pessimistic Write Lock và trả về entity đã khóa.
     * Dùng chung cho withdraw và transfer để tránh lặp code.
     */
    private Account lockAccount(UUID accountId, String label) {
        return accountRepository.findByIdWithLock(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy " + label));
    }

    // ==================== LỊCH SỬ GIAO DỊCH ====================

    /**
     * Lấy lịch sử giao dịch của một tài khoản (phân trang).
     *
     * Fix #5 (IDOR): BẮT BUỘC kiểm tra ví thuộc về user đang đăng nhập trước khi
     * trả dữ liệu. Nếu không, User A có thể xem lịch sử giao dịch của User B chỉ
     * bằng cách đoán/đổi accountId trên URL.
     *
     * @param accountId ví cần xem lịch sử
     * @param userId    user đang đăng nhập (từ JWT)
     */
    @Transactional(readOnly = true)
    public Page<TransactionResponse> getTransactionHistory(UUID accountId, UUID userId, Pageable pageable) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ví"));

        if (!account.getUser().getId().equals(userId)) {
            throw new UnauthorizedAccessException("Bạn không có quyền xem lịch sử giao dịch của ví này");
        }

        return transactionRepository.findByAccountId(accountId, pageable)
                .map(this::toResponse);
    }

    /**
     * Chuyển Transaction entity → TransactionEvent (Kafka DTO).
     *
     * Tại sao cần method riêng?
     * - Tránh lặp code ở 3 nơi (topUp, withdraw, transfer)
     * - Đảm bảo mọi event có cùng format
     * - Dễ thêm trường mới sau này (VD: userId, deviceInfo)
     */
    private TransactionEvent buildEvent(Transaction transaction, UUID userId) {
        return TransactionEvent.builder()
                .transactionId(transaction.getId())
                .userId(userId)
                .referenceNumber(transaction.getReferenceNumber())
                .transactionType(transaction.getTransactionType().name())
                .sourceAccountNumber(
                        transaction.getSourceAccount() != null
                                ? transaction.getSourceAccount().getAccountNumber()
                                : null)
                .destinationAccountNumber(
                        transaction.getDestinationAccount() != null
                                ? transaction.getDestinationAccount().getAccountNumber()
                                : null)
                .amount(transaction.getAmount())
                .currency(transaction.getCurrency())
                .status(transaction.getStatus().name())
                .description(transaction.getDescription())
                .timestamp(LocalDateTime.now().toString())
                .build();
    }

    /**
     * Kiểm tra ví có đang ACTIVE không.
     */
    private void validateAccountActive(Account account) {
        if (account.getStatus() != AccountStatus.ACTIVE) {
            throw new IllegalStateException(
                    String.format("Ví %s đang ở trạng thái %s, không thể giao dịch",
                            account.getAccountNumber(), account.getStatus()));
        }
    }

    /**
     * Kiểm tra user có đủ điều kiện thực hiện giao dịch không.
     *
     * 2 kiểm tra:
     * 1. User bị LOCKED → chặn MỌI giao dịch (bất kể số tiền)
     * 2. User chưa KYC + giao dịch > 10 triệu VNĐ → chặn
     *
     * Tại sao kiểm tra ở tầng User thay vì tầng Account?
     * → Account (ví) chỉ biết trạng thái ví (ACTIVE/CLOSED).
     * → KYC là thông tin của User (người sở hữu ví).
     * → Một user có thể có nhiều ví, nhưng KYC chỉ cần xác thực 1 lần.
     *
     * Tại sao đặt ngưỡng 10 triệu VNĐ?
     * → Theo quy định pháp luật Việt Nam, giao dịch trên một ngưỡng nhất định
     *   yêu cầu xác thực danh tính (KYC) để phòng chống rửa tiền (AML).
     * → 10 triệu là ngưỡng phổ biến cho ví điện tử.
     */
    private void validateUserForTransaction(UUID userId, BigDecimal amount) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy người dùng"));

        // Kiểm tra 1: Tài khoản bị khóa → chặn mọi giao dịch
        if ("LOCKED".equals(user.getStatus())) {
            throw new AccountLockedException(
                    "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ.");
        }

        // Kiểm tra 2: Chưa KYC + giao dịch lớn → yêu cầu KYC
        if (user.getKycStatus() != KycStatus.VERIFIED && amount.compareTo(KYC_THRESHOLD) > 0) {
            throw new KycRequiredException(
                    String.format("Giao dịch trên %s VNĐ yêu cầu xác thực danh tính (KYC). "
                            + "Vui lòng hoàn tất KYC trước khi thực hiện.", KYC_THRESHOLD.toPlainString()));
        }
    }

    /**
     * Chuyển Entity → Response DTO.
     */
    private TransactionResponse toResponse(Transaction transaction) {
        return TransactionResponse.builder()
                .id(transaction.getId())
                .referenceNumber(transaction.getReferenceNumber())
                .transactionType(transaction.getTransactionType().name())
                .sourceAccountNumber(
                        transaction.getSourceAccount() != null
                                ? transaction.getSourceAccount().getAccountNumber()
                                : null)
                .destinationAccountNumber(
                        transaction.getDestinationAccount() != null
                                ? transaction.getDestinationAccount().getAccountNumber()
                                : null)
                .amount(transaction.getAmount())
                .fee(transaction.getFee())
                .currency(transaction.getCurrency())
                .description(transaction.getDescription())
                .status(transaction.getStatus().name())
                .createdAt(transaction.getCreatedAt())
                .build();
    }
}
