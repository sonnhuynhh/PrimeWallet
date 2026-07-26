package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.common.exception.DuplicateTransactionException;
import com.sonnhuynhh.primewallet.common.exception.InsufficientBalanceException;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
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
    private final LedgerService ledgerService;
    private final ReferenceNumberGenerator referenceNumberGenerator;
    private final TransactionEventPublisher eventPublisher;

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

        // 2. Lấy ví chính của user
        Account account = accountRepository
                .findByUserIdAndCurrencyAndAccountType(userId, "VND", "PRIMARY")
                .orElseThrow(() -> new ResourceNotFoundException("Chưa có ví. Vui lòng tạo ví trước."));

        // 3. Kiểm tra ví có đang hoạt động không
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
        eventPublisher.publish(buildEvent(transaction));

        log.info("Nạp tiền thành công: {} VNĐ vào ví {}", request.getAmount(), account.getAccountNumber());
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

        // 2. Lấy ví chính của user
        Account account = accountRepository
                .findByUserIdAndCurrencyAndAccountType(userId, "VND", "PRIMARY")
                .orElseThrow(() -> new ResourceNotFoundException("Chưa có ví. Vui lòng tạo ví trước."));

        // 3. Khóa ví (Pessimistic Lock) — đảm bảo không ai khác đang trừ tiền đồng thời
        account = accountRepository.findByIdWithLock(account.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ví"));

        // 4. Kiểm tra trạng thái ví
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
        eventPublisher.publish(buildEvent(transaction));

        log.info("Rút tiền thành công: {} VNĐ từ ví {}", request.getAmount(), account.getAccountNumber());
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

        // 2. Lấy ví gửi (ví chính VNĐ của user hiện tại)
        Account sourceAccount = accountRepository
                .findByUserIdAndCurrencyAndAccountType(userId, "VND", "PRIMARY")
                .orElseThrow(() -> new ResourceNotFoundException("Chưa có ví. Vui lòng tạo ví trước."));

        // 3. KHÓA ví gửi (Pessimistic Lock)
        sourceAccount = accountRepository.findByIdWithLock(sourceAccount.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy ví gửi"));

        // 4. Tìm ví nhận theo số tài khoản
        Account destAccount = accountRepository.findByAccountNumber(request.getDestinationAccountNumber())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Không tìm thấy ví nhận với số tài khoản: " + request.getDestinationAccountNumber()));

        // 5. Validate
        if (sourceAccount.getId().equals(destAccount.getId())) {
            throw new IllegalArgumentException("Không thể chuyển tiền cho chính mình");
        }
        validateAccountActive(sourceAccount);
        validateAccountActive(destAccount);

        if (sourceAccount.getBalance().compareTo(request.getAmount()) < 0) {
            throw new InsufficientBalanceException(
                    String.format("Số dư không đủ. Hiện có: %s VNĐ, cần: %s VNĐ",
                            sourceAccount.getBalance(), request.getAmount()));
        }

        // 6. Tạo Transaction (TRANSFER)
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

        // 7. GHI SỔ KÉP (Double-Entry) — Đây là bước quan trọng nhất!
        //    Bước 7a: DEBIT ví gửi (trừ tiền)
        ledgerService.debit(sourceAccount, transaction, request.getAmount());
        //    Bước 7b: CREDIT ví nhận (cộng tiền)
        ledgerService.credit(destAccount, transaction, request.getAmount());

        // 8. Cập nhật trạng thái
        transaction.setStatus(TransactionStatus.SUCCESS);
        transaction = transactionRepository.save(transaction);

        // 9. Phát event lên Kafka
        eventPublisher.publish(buildEvent(transaction));

        log.info("Chuyển tiền thành công: {} VNĐ từ {} → {}",
                request.getAmount(), sourceAccount.getAccountNumber(), destAccount.getAccountNumber());
        return toResponse(transaction);
    }

    // ==================== LỊCH SỬ GIAO DỊCH ====================

    /**
     * Lấy lịch sử giao dịch của một tài khoản (phân trang).
     */
    @Transactional(readOnly = true)
    public Page<TransactionResponse> getTransactionHistory(UUID accountId, Pageable pageable) {
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
    private TransactionEvent buildEvent(Transaction transaction) {
        return TransactionEvent.builder()
                .transactionId(transaction.getId())
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
