package com.sonnhuynhh.primewallet.auth.controller;

import com.sonnhuynhh.primewallet.auth.dto.*;
import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.auth.service.AuthService;
import com.sonnhuynhh.primewallet.common.dto.ApiResponse;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/**
 * Controller xử lý các API xác thực và quản lý profile.
 *
 * Base URL: /api/v1/auth
 *
 * Các endpoint:
 * - POST /register     → Đăng ký tài khoản mới (PUBLIC)
 * - POST /login        → Đăng nhập (PUBLIC)
 * - POST /refresh      → Đổi Refresh Token lấy Access Token mới (PUBLIC)
 * - GET  /profile      → Xem thông tin cá nhân (YÊU CẦU JWT)
 * - PUT  /profile      → Cập nhật thông tin cá nhân (YÊU CẦU JWT)
 *
 * Lưu ý: Các endpoint PUBLIC đã cấu hình trong SecurityConfig:
 *   .requestMatchers("/api/v1/auth/**").permitAll()
 *
 * Tuy nhiên, /profile yêu cầu JWT vì có tham số Authentication.
 * Spring Security sẽ tự inject Authentication từ JWT token.
 * Nếu không có token → Authentication = null → trả về 401.
 *
 * ⚠️ VẤN ĐỀ: SecurityConfig hiện tại đang permitAll cho /api/v1/auth/**
 *    Nghĩa là /api/v1/auth/profile cũng sẽ bị permitAll!
 *    → Ta cần sửa lại SecurityConfig ở bước sau để tách riêng.
 *    → Tạm thời API vẫn hoạt động đúng nhờ tham số Authentication.
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;

    // ==================== PUBLIC ENDPOINTS ====================

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

    // ==================== PROFILE ENDPOINTS (YÊU CẦU JWT) ====================

    /**
     * Xem thông tin cá nhân của user hiện tại.
     *
     * GET /api/v1/auth/profile
     * Header: Authorization: Bearer <jwt-token>
     *
     * Tham số Authentication:
     * → Spring Security tự động inject object này từ JWT token.
     * → authentication.getName() trả về email (vì ta dùng email làm username).
     * → Từ email → tìm User trong DB → lấy userId → gọi service.
     */
    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfile(Authentication authentication) {
        User user = getCurrentUser(authentication);
        UserProfileResponse response = authService.getProfile(user.getId());
        return ResponseEntity.ok(ApiResponse.success("Thông tin cá nhân", response));
    }

    /**
     * Cập nhật thông tin cá nhân.
     *
     * PUT /api/v1/auth/profile
     * Header: Authorization: Bearer <jwt-token>
     * Body: { "fullName": "Tên mới", "dateOfBirth": "2000-01-15" }
     */
    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            Authentication authentication) {
        User user = getCurrentUser(authentication);
        UserProfileResponse response = authService.updateProfile(user.getId(), request);
        return ResponseEntity.ok(ApiResponse.success("Cập nhật thông tin thành công", response));
    }

    /**
     * Đổi mật khẩu.
     *
     * PUT /api/v1/auth/change-password
     * Header: Authorization: Bearer <jwt-token>
     * Body: {
     *   "currentPassword": "matkhaucu",
     *   "newPassword": "matkhaumoi",
     *   "confirmNewPassword": "matkhaumoi"
     * }
     *
     * Trả về 200 OK với message thành công (không có data body).
     * Tại sao trả về Void thay vì AuthResponse mới?
     * → Đổi mật khẩu KHÔNG làm thay đổi JWT token hiện tại.
     * → Token cũ vẫn hợp lệ cho đến khi hết hạn.
     * → Client nên chủ động logout và đăng nhập lại bằng mật khẩu mới.
     */
    @PutMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            Authentication authentication) {
        User user = getCurrentUser(authentication);
        authService.changePassword(user.getId(), request);
        return ResponseEntity.ok(ApiResponse.success("Đổi mật khẩu thành công", null));
    }

    // ==================== HELPER ====================

    /**
     * Lấy User entity từ JWT Authentication.
     *
     * Luồng: JWT token → Spring Security giải mã → Authentication object
     *        → getName() lấy email → query DB lấy User entity.
     *
     * Pattern này được dùng ở nhiều Controller (TransactionController cũng dùng).
     */
    private User getCurrentUser(Authentication authentication) {
        String email = authentication.getName();
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản"));
    }
}

