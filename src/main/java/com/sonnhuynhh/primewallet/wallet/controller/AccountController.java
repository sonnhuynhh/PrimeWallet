package com.sonnhuynhh.primewallet.wallet.controller;

import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.dto.ApiResponse;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import com.sonnhuynhh.primewallet.wallet.dto.AccountResponse;
import com.sonnhuynhh.primewallet.wallet.service.AccountService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Controller quản lý tài khoản ví.
 *
 * Base URL: /api/v1/accounts
 *
 * Tất cả endpoint trong controller này yêu cầu JWT token (đã xác thực).
 * User hiện tại được xác định từ JWT token (qua Authentication object).
 */
@RestController
@RequestMapping("/api/v1/accounts")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;
    private final UserRepository userRepository;

    /**
     * Tạo ví mặc định (VNĐ) cho user hiện tại.
     *
     * POST /api/v1/accounts
     *
     * Gọi 1 lần sau khi đăng ký. Nếu đã có ví → trả lỗi.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<AccountResponse>> createAccount(Authentication authentication) {
        User user = getCurrentUser(authentication);
        AccountResponse response = accountService.createDefaultAccount(user.getId());
        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(ApiResponse.success("Tạo ví thành công", response));
    }

    /**
     * Lấy thông tin ví chính (PRIMARY VNĐ) của user hiện tại.
     *
     * GET /api/v1/accounts/me
     */
    @GetMapping("/me")
    public ResponseEntity<ApiResponse<AccountResponse>> getMyAccount(Authentication authentication) {
        User user = getCurrentUser(authentication);
        AccountResponse response = accountService.getMyPrimaryAccount(user.getId());
        return ResponseEntity.ok(ApiResponse.success("Thông tin ví", response));
    }

    /**
     * Lấy danh sách tất cả ví của user hiện tại.
     *
     * GET /api/v1/accounts
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<AccountResponse>>> getMyAccounts(Authentication authentication) {
        User user = getCurrentUser(authentication);
        List<AccountResponse> responses = accountService.getMyAccounts(user.getId());
        return ResponseEntity.ok(ApiResponse.success("Danh sách ví", responses));
    }

    // ==================== HELPER ====================

    /**
     * Lấy User entity từ Authentication (JWT token).
     *
     * Authentication.getName() trả về email (subject trong JWT).
     * Từ email → query database lấy User entity.
     */
    private User getCurrentUser(Authentication authentication) {
        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản"));
    }
}
