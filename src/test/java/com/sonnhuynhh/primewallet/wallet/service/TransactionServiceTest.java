package com.sonnhuynhh.primewallet.wallet.service;

import com.sonnhuynhh.primewallet.auth.entity.KycStatus;
import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.exception.AccountLockedException;
import com.sonnhuynhh.primewallet.common.exception.InsufficientBalanceException;
import com.sonnhuynhh.primewallet.common.exception.KycRequiredException;
import com.sonnhuynhh.primewallet.common.exception.UnauthorizedAccessException;
import com.sonnhuynhh.primewallet.common.service.AuditService;
import com.sonnhuynhh.primewallet.common.util.ReferenceNumberGenerator;
import com.sonnhuynhh.primewallet.wallet.dto.*;
import com.sonnhuynhh.primewallet.wallet.entity.Account;
import com.sonnhuynhh.primewallet.wallet.entity.Transaction;
import com.sonnhuynhh.primewallet.wallet.enums.AccountStatus;
import com.sonnhuynhh.primewallet.wallet.event.TransactionEventPublisher;
import com.sonnhuynhh.primewallet.wallet.repository.AccountRepository;
import com.sonnhuynhh.primewallet.wallet.repository.TransactionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit test cho TransactionService — service quan trọng nhất (xử lý tiền).
 *
 * Đây là test THUẦN Mockito (KHÔNG cần Spring context, Postgres, Kafka hay Redis)
 * nên chạy được ở mọi nơi kể cả CI không có Docker.
 *
 * Bao phủ các nhánh nghiệp vụ then chốt:
 * - Idempotency (chống giao dịch trùng)
 * - Số dư không đủ
 * - Tài khoản bị khóa
 * - Ngưỡng KYC (10 triệu)
 * - Chuyển cho chính mình
 * - Double-entry (DEBIT ví gửi + CREDIT ví nhận)
 * - Khóa CẢ 2 ví khi chuyển tiền (Fix #2)
 * - IDOR khi xem lịch sử (Fix #5)
 */
@ExtendWith(MockitoExtension.class)
class TransactionServiceTest {

    @Mock private TransactionRepository transactionRepository;
    @Mock private AccountRepository accountRepository;
    @Mock private UserRepository userRepository;
    @Mock private LedgerService ledgerService;
    @Mock private ReferenceNumberGenerator referenceNumberGenerator;
    @Mock private TransactionEventPublisher eventPublisher;
    @Mock private AuditService auditService;

    @InjectMocks private TransactionService transactionService;

    private UUID userId;
    private User activeUser;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        activeUser = User.builder()
                .id(userId)
                .email("test@example.com")
                .kycStatus(KycStatus.VERIFIED)
                .status("ACTIVE")
                .build();
    }

    private Account account(UUID id, UUID ownerId, BigDecimal balance, String number) {
        User owner = User.builder().id(ownerId).build();
        return Account.builder()
                .id(id)
                .user(owner)
                .accountNumber(number)
                .balance(balance)
                .currency("VND")
                .accountType("PRIMARY")
                .status(AccountStatus.ACTIVE)
                .build();
    }

    // ==================== TOP UP ====================

    @Nested
    @DisplayName("Nạp tiền (topUp)")
    class TopUp {

        @Test
        @DisplayName("Idempotency: giao dịch đã tồn tại → trả kết quả cũ, KHÔNG tạo mới")
        void topUp_duplicateIdempotencyKey_returnsExisting() {
            UUID key = UUID.randomUUID();
            Transaction existing = Transaction.builder()
                    .idempotencyKey(key)
                    .transactionType(com.sonnhuynhh.primewallet.wallet.enums.TransactionType.TOPUP)
                    .status(com.sonnhuynhh.primewallet.wallet.enums.TransactionStatus.SUCCESS)
                    .amount(new BigDecimal("50000"))
                    .currency("VND")
                    .build();
            when(transactionRepository.findByIdempotencyKey(key)).thenReturn(Optional.of(existing));

            TopUpRequest request = TopUpRequest.builder().idempotencyKey(key).amount(new BigDecimal("50000")).build();
            TransactionResponse response = transactionService.topUp(request, userId);

            assertThat(response).isNotNull();
            // KHÔNG được ghi sổ hay tạo transaction mới
            verify(ledgerService, never()).credit(any(), any(), any());
            verify(transactionRepository, never()).save(any());
        }

        @Test
        @DisplayName("Thành công: CREDIT vào ví + phát event + audit log")
        void topUp_success_creditsWallet() {
            UUID key = UUID.randomUUID();
            Account acc = account(UUID.randomUUID(), userId, new BigDecimal("100000"), "PW001");
            when(transactionRepository.findByIdempotencyKey(key)).thenReturn(Optional.empty());
            when(userRepository.findById(userId)).thenReturn(Optional.of(activeUser));
            when(accountRepository.findByUserIdAndCurrencyAndAccountType(userId, "VND", "PRIMARY"))
                    .thenReturn(Optional.of(acc));
            when(referenceNumberGenerator.generateTransactionReference()).thenReturn("TXN-1");
            when(transactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            TopUpRequest request = TopUpRequest.builder().idempotencyKey(key).amount(new BigDecimal("50000")).build();
            TransactionResponse response = transactionService.topUp(request, userId);

            assertThat(response.getStatus()).isEqualTo("SUCCESS");
            verify(ledgerService).credit(eq(acc), any(), eq(new BigDecimal("50000")));
            verify(eventPublisher).publish(any());
        }

        @Test
        @DisplayName("Tài khoản bị khóa → AccountLockedException, KHÔNG cộng tiền")
        void topUp_lockedUser_throws() {
            UUID key = UUID.randomUUID();
            activeUser.setStatus("LOCKED");
            when(transactionRepository.findByIdempotencyKey(key)).thenReturn(Optional.empty());
            when(userRepository.findById(userId)).thenReturn(Optional.of(activeUser));

            TopUpRequest request = TopUpRequest.builder().idempotencyKey(key).amount(new BigDecimal("50000")).build();

            assertThatThrownBy(() -> transactionService.topUp(request, userId))
                    .isInstanceOf(AccountLockedException.class);
            verify(ledgerService, never()).credit(any(), any(), any());
        }
    }

    // ==================== WITHDRAW ====================

    @Nested
    @DisplayName("Rút tiền (withdraw)")
    class Withdraw {

        @Test
        @DisplayName("Số dư không đủ → InsufficientBalanceException")
        void withdraw_insufficientBalance_throws() {
            UUID key = UUID.randomUUID();
            UUID accId = UUID.randomUUID();
            Account acc = account(accId, userId, new BigDecimal("10000"), "PW001");
            when(transactionRepository.findByIdempotencyKey(key)).thenReturn(Optional.empty());
            when(userRepository.findById(userId)).thenReturn(Optional.of(activeUser));
            when(accountRepository.findByUserIdAndCurrencyAndAccountType(userId, "VND", "PRIMARY"))
                    .thenReturn(Optional.of(acc));
            when(accountRepository.findByIdWithLock(accId)).thenReturn(Optional.of(acc));

            WithdrawRequest request = WithdrawRequest.builder()
                    .idempotencyKey(key).amount(new BigDecimal("50000")).build();

            assertThatThrownBy(() -> transactionService.withdraw(request, userId))
                    .isInstanceOf(InsufficientBalanceException.class);
            verify(ledgerService, never()).debit(any(), any(), any());
        }

        @Test
        @DisplayName("Thành công: DEBIT khỏi ví (đã khóa Pessimistic)")
        void withdraw_success_debits() {
            UUID key = UUID.randomUUID();
            UUID accId = UUID.randomUUID();
            Account acc = account(accId, userId, new BigDecimal("100000"), "PW001");
            when(transactionRepository.findByIdempotencyKey(key)).thenReturn(Optional.empty());
            when(userRepository.findById(userId)).thenReturn(Optional.of(activeUser));
            when(accountRepository.findByUserIdAndCurrencyAndAccountType(userId, "VND", "PRIMARY"))
                    .thenReturn(Optional.of(acc));
            when(accountRepository.findByIdWithLock(accId)).thenReturn(Optional.of(acc));
            when(referenceNumberGenerator.generateTransactionReference()).thenReturn("TXN-2");
            when(transactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            WithdrawRequest request = WithdrawRequest.builder()
                    .idempotencyKey(key).amount(new BigDecimal("50000")).build();
            TransactionResponse response = transactionService.withdraw(request, userId);

            assertThat(response.getStatus()).isEqualTo("SUCCESS");
            verify(accountRepository).findByIdWithLock(accId); // đã khóa ví
            verify(ledgerService).debit(eq(acc), any(), eq(new BigDecimal("50000")));
        }
    }

    // ==================== TRANSFER ====================

    @Nested
    @DisplayName("Chuyển tiền (transfer)")
    class Transfer {

        @Test
        @DisplayName("Thành công: khóa CẢ 2 ví + double-entry (DEBIT gửi, CREDIT nhận) — Fix #2")
        void transfer_success_locksBothAndDoubleEntry() {
            UUID key = UUID.randomUUID();
            UUID srcId = UUID.randomUUID();
            UUID dstId = UUID.randomUUID();
            Account src = account(srcId, userId, new BigDecimal("100000"), "PW-SRC");
            Account dst = account(dstId, UUID.randomUUID(), new BigDecimal("0"), "PW-DST");

            when(transactionRepository.findByIdempotencyKey(key)).thenReturn(Optional.empty());
            when(userRepository.findById(userId)).thenReturn(Optional.of(activeUser));
            when(accountRepository.findByUserIdAndCurrencyAndAccountType(userId, "VND", "PRIMARY"))
                    .thenReturn(Optional.of(src));
            when(accountRepository.findByAccountNumber("PW-DST")).thenReturn(Optional.of(dst));
            when(accountRepository.findByIdWithLock(srcId)).thenReturn(Optional.of(src));
            when(accountRepository.findByIdWithLock(dstId)).thenReturn(Optional.of(dst));
            when(referenceNumberGenerator.generateTransactionReference()).thenReturn("TXN-3");
            when(transactionRepository.save(any())).thenAnswer(i -> i.getArgument(0));

            TransferRequest request = TransferRequest.builder()
                    .idempotencyKey(key).destinationAccountNumber("PW-DST")
                    .amount(new BigDecimal("30000")).build();
            TransactionResponse response = transactionService.transfer(request, userId);

            assertThat(response.getStatus()).isEqualTo("SUCCESS");
            // CẢ 2 ví đều bị khóa (Fix #2 — trước đây chỉ khóa ví gửi)
            verify(accountRepository).findByIdWithLock(srcId);
            verify(accountRepository).findByIdWithLock(dstId);
            // Double-entry
            verify(ledgerService).debit(eq(src), any(), eq(new BigDecimal("30000")));
            verify(ledgerService).credit(eq(dst), any(), eq(new BigDecimal("30000")));
        }

        @Test
        @DisplayName("Chuyển cho chính mình → IllegalArgumentException")
        void transfer_toSelf_throws() {
            UUID key = UUID.randomUUID();
            UUID accId = UUID.randomUUID();
            Account acc = account(accId, userId, new BigDecimal("100000"), "PW-ME");
            when(transactionRepository.findByIdempotencyKey(key)).thenReturn(Optional.empty());
            when(userRepository.findById(userId)).thenReturn(Optional.of(activeUser));
            when(accountRepository.findByUserIdAndCurrencyAndAccountType(userId, "VND", "PRIMARY"))
                    .thenReturn(Optional.of(acc));
            when(accountRepository.findByAccountNumber("PW-ME")).thenReturn(Optional.of(acc));

            TransferRequest request = TransferRequest.builder()
                    .idempotencyKey(key).destinationAccountNumber("PW-ME")
                    .amount(new BigDecimal("30000")).build();

            assertThatThrownBy(() -> transactionService.transfer(request, userId))
                    .isInstanceOf(IllegalArgumentException.class);
            verify(ledgerService, never()).debit(any(), any(), any());
            verify(ledgerService, never()).credit(any(), any(), any());
        }

        @Test
        @DisplayName("Chưa KYC + giao dịch > 10 triệu → KycRequiredException")
        void transfer_overKycThreshold_notVerified_throws() {
            UUID key = UUID.randomUUID();
            activeUser.setKycStatus(KycStatus.PENDING);
            when(transactionRepository.findByIdempotencyKey(key)).thenReturn(Optional.empty());
            when(userRepository.findById(userId)).thenReturn(Optional.of(activeUser));

            TransferRequest request = TransferRequest.builder()
                    .idempotencyKey(key).destinationAccountNumber("PW-DST")
                    .amount(new BigDecimal("20000000")).build(); // 20 triệu > 10 triệu

            assertThatThrownBy(() -> transactionService.transfer(request, userId))
                    .isInstanceOf(KycRequiredException.class);
        }

        @Test
        @DisplayName("Số dư không đủ → InsufficientBalanceException, KHÔNG ghi sổ")
        void transfer_insufficientBalance_throws() {
            UUID key = UUID.randomUUID();
            UUID srcId = UUID.randomUUID();
            UUID dstId = UUID.randomUUID();
            Account src = account(srcId, userId, new BigDecimal("10000"), "PW-SRC");
            Account dst = account(dstId, UUID.randomUUID(), new BigDecimal("0"), "PW-DST");
            when(transactionRepository.findByIdempotencyKey(key)).thenReturn(Optional.empty());
            when(userRepository.findById(userId)).thenReturn(Optional.of(activeUser));
            when(accountRepository.findByUserIdAndCurrencyAndAccountType(userId, "VND", "PRIMARY"))
                    .thenReturn(Optional.of(src));
            when(accountRepository.findByAccountNumber("PW-DST")).thenReturn(Optional.of(dst));
            when(accountRepository.findByIdWithLock(srcId)).thenReturn(Optional.of(src));
            when(accountRepository.findByIdWithLock(dstId)).thenReturn(Optional.of(dst));

            TransferRequest request = TransferRequest.builder()
                    .idempotencyKey(key).destinationAccountNumber("PW-DST")
                    .amount(new BigDecimal("50000")).build();

            assertThatThrownBy(() -> transactionService.transfer(request, userId))
                    .isInstanceOf(InsufficientBalanceException.class);
            verify(ledgerService, never()).debit(any(), any(), any());
            verify(ledgerService, never()).credit(any(), any(), any());
        }
    }

    // ==================== HISTORY (IDOR - Fix #5) ====================

    @Nested
    @DisplayName("Lịch sử giao dịch (IDOR - Fix #5)")
    class History {

        @Test
        @DisplayName("Ví KHÔNG thuộc user → UnauthorizedAccessException")
        void history_notOwner_throwsUnauthorized() {
            UUID accId = UUID.randomUUID();
            UUID otherUserId = UUID.randomUUID();
            Account someoneElsesAccount = account(accId, otherUserId, new BigDecimal("0"), "PW-OTHER");
            when(accountRepository.findById(accId)).thenReturn(Optional.of(someoneElsesAccount));

            assertThatThrownBy(() -> transactionService.getTransactionHistory(
                    accId, userId, org.springframework.data.domain.PageRequest.of(0, 20)))
                    .isInstanceOf(UnauthorizedAccessException.class);
            verify(transactionRepository, never()).findByAccountId(any(), any());
        }

        @Test
        @DisplayName("Ví thuộc user → trả về dữ liệu")
        void history_owner_returnsData() {
            UUID accId = UUID.randomUUID();
            Account myAccount = account(accId, userId, new BigDecimal("0"), "PW-MINE");
            when(accountRepository.findById(accId)).thenReturn(Optional.of(myAccount));
            when(transactionRepository.findByAccountId(eq(accId), any()))
                    .thenReturn(org.springframework.data.domain.Page.empty());

            var page = transactionService.getTransactionHistory(
                    accId, userId, org.springframework.data.domain.PageRequest.of(0, 20));

            assertThat(page).isNotNull();
            verify(transactionRepository).findByAccountId(eq(accId), any());
        }
    }
}
