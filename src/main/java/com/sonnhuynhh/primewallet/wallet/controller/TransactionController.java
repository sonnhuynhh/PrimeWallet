package com.sonnhuynhh.primewallet.wallet.controller;

import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.dto.ApiResponse;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import com.sonnhuynhh.primewallet.wallet.dto.*;
import com.sonnhuynhh.primewallet.wallet.service.TransactionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Controller xử lý các giao dịch tài chính.
 *
 * Base URL: /api/v1/transactions
 *
 * Endpoints:
 * - POST /top-up    → Nạp tiền vào ví
 * - POST /withdraw  → Rút tiền từ ví
 * - POST /transfer  → Chuyển tiền nội bộ
 * - GET  /history/{accountId} → Lịch sử giao dịch
 *
 * Tất cả endpoint yêu cầu JWT token (đã xác thực).
 */
@RestController
@RequestMapping("/api/v1/transactions")
@RequiredArgsConstructor
public class TransactionController {

    private final TransactionService transactionService;
    private final UserRepository userRepository;

    /**
     * Nạp tiền vào ví.
     *
     * POST /api/v1/transactions/top-up
     * Body: { "idempotencyKey": "uuid", "amount": 100000, "description": "Nạp tiền" }
     */
    @PostMapping("/top-up")
    public ResponseEntity<ApiResponse<TransactionResponse>> topUp(
            @Valid @RequestBody TopUpRequest request,
            Authentication authentication) {

        User user = getCurrentUser(authentication);
        TransactionResponse response = transactionService.topUp(request, user.getId());
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Nạp tiền thành công", response));
    }

    /**
     * Rút tiền từ ví.
     *
     * POST /api/v1/transactions/withdraw
     * Body: { "idempotencyKey": "uuid", "amount": 50000 }
     */
    @PostMapping("/withdraw")
    public ResponseEntity<ApiResponse<TransactionResponse>> withdraw(
            @Valid @RequestBody WithdrawRequest request,
            Authentication authentication) {

        User user = getCurrentUser(authentication);
        TransactionResponse response = transactionService.withdraw(request, user.getId());
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Rút tiền thành công", response));
    }

    /**
     * Chuyển tiền nội bộ.
     *
     * POST /api/v1/transactions/transfer
     * Body: { "idempotencyKey": "uuid", "destinationAccountNumber": "PW12345678", "amount": 100000, "description": "Tiền ăn trưa" }
     */
    @PostMapping("/transfer")
    public ResponseEntity<ApiResponse<TransactionResponse>> transfer(
            @Valid @RequestBody TransferRequest request,
            Authentication authentication) {

        User user = getCurrentUser(authentication);
        TransactionResponse response = transactionService.transfer(request, user.getId());
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Chuyển tiền thành công", response));
    }

    /**
     * Lấy lịch sử giao dịch của một tài khoản (phân trang).
     *
     * GET /api/v1/transactions/history/{accountId}?page=0&size=10
     *
     * @PageableDefault: Nếu client không truyền page/size → mặc định page=0, size=20.
     */
    @GetMapping("/history/{accountId}")
    public ResponseEntity<ApiResponse<Page<TransactionResponse>>> getHistory(
            @PathVariable UUID accountId,
            @PageableDefault(size = 20) Pageable pageable,
            Authentication authentication) {

        User user = getCurrentUser(authentication);
        Page<TransactionResponse> history = transactionService.getTransactionHistory(accountId, user.getId(), pageable);
        return ResponseEntity.ok(ApiResponse.success("Lịch sử giao dịch", history));
    }

    // ==================== HELPER ====================

    private User getCurrentUser(Authentication authentication) {
        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản"));
    }
}
