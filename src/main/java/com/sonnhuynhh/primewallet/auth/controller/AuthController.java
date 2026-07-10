package com.sonnhuynhh.primewallet.auth.controller;

import com.sonnhuynhh.primewallet.auth.dto.*;
import com.sonnhuynhh.primewallet.auth.service.AuthService;
import com.sonnhuynhh.primewallet.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Controller xử lý các API xác thực.
 *
 * Base URL: /api/v1/auth
 *
 * Các endpoint:
 * - POST /register  → Đăng ký tài khoản mới
 * - POST /login     → Đăng nhập
 * - POST /refresh   → Đổi Refresh Token lấy Access Token mới
 *
 * Tất cả endpoint trong controller này đều PUBLIC (không cần JWT).
 * Đã cấu hình trong SecurityConfig: .requestMatchers("/api/v1/auth/**").permitAll()
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * API Đăng ký tài khoản.
     *
     * Request Body:
     * {
     *   "email": "user@example.com",
     *   "phone": "0912345678",
     *   "password": "123456",
     *   "fullName": "Nguyễn Văn A"
     * }
     *
     * @Valid: Kích hoạt validation trên RegisterRequest
     *        Nếu dữ liệu không hợp lệ → ném MethodArgumentNotValidException
     *        → Bắt ở GlobalExceptionHandler
     */
    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity
                .status(HttpStatus.CREATED) // 201 Created
                .body(ApiResponse.success("Đăng ký thành công", response));
    }

    /**
     * API Đăng nhập.
     *
     * Request Body:
     * {
     *   "email": "user@example.com",
     *   "password": "123456"
     * }
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(ApiResponse.success("Đăng nhập thành công", response));
    }

    /**
     * API Refresh Token — Lấy Access Token mới khi token cũ hết hạn.
     *
     * Request Body:
     * {
     *   "refreshToken": "uuid-string..."
     * }
     */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<AuthResponse>> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        AuthResponse response = authService.refreshToken(request);
        return ResponseEntity.ok(ApiResponse.success("Token đã được làm mới", response));
    }
}
