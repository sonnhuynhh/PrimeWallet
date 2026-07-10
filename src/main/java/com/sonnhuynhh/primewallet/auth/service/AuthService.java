package com.sonnhuynhh.primewallet.auth.service;

import com.sonnhuynhh.primewallet.auth.dto.*;
import com.sonnhuynhh.primewallet.auth.entity.RefreshToken;
import com.sonnhuynhh.primewallet.auth.entity.Role;
import com.sonnhuynhh.primewallet.auth.entity.User;
import com.sonnhuynhh.primewallet.auth.repository.RefreshTokenRepository;
import com.sonnhuynhh.primewallet.auth.repository.UserRepository;
import com.sonnhuynhh.primewallet.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Service xử lý toàn bộ logic xác thực (Authentication).
 *
 * Luồng đăng ký:
 * 1. Kiểm tra email/phone chưa tồn tại
 * 2. Mã hóa mật khẩu bằng BCrypt
 * 3. Lưu User vào database
 * 4. Tạo Access Token + Refresh Token
 * 5. Trả về AuthResponse cho client
 *
 * Luồng đăng nhập:
 * 1. Spring Security xác thực email/password
 * 2. Nếu đúng → Tạo Access Token + Refresh Token mới
 * 3. Thu hồi tất cả Refresh Token cũ (Token Rotation)
 *
 * Luồng Refresh Token:
 * 1. Kiểm tra refresh token có tồn tại và còn hợp lệ
 * 2. Thu hồi token cũ, tạo token mới (Rotation)
 * 3. Tạo Access Token mới
 */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final UserDetailsService userDetailsService;

    @Value("${jwt.refresh-token-expiration}")
    private long refreshTokenExpiration; // 7 ngày = 604800000ms

    // ==================== ĐĂNG KÝ ====================

    /**
     * Đăng ký tài khoản mới.
     */
    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // 1. Kiểm tra email đã tồn tại chưa
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email đã được sử dụng");
        }

        // 2. Kiểm tra SĐT đã tồn tại chưa
        if (userRepository.existsByPhone(request.getPhone())) {
            throw new IllegalArgumentException("Số điện thoại đã được sử dụng");
        }

        // 3. Tạo User mới (mật khẩu được mã hóa bằng BCrypt)
        User user = User.builder()
                .email(request.getEmail())
                .phone(request.getPhone())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .fullName(request.getFullName())
                .role(Role.USER) // Mặc định là USER
                .build();

        user = userRepository.save(user);

        // 4. Tạo token và trả về
        return generateAuthResponse(user);
    }

    // ==================== ĐĂNG NHẬP ====================

    /**
     * Đăng nhập bằng email + password.
     */
    @Transactional
    public AuthResponse login(LoginRequest request) {
        // 1. Spring Security xác thực email/password
        //    Nếu sai → ném BadCredentialsException → bắt ở GlobalExceptionHandler
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );

        // 2. Lấy User từ database
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản"));

        // 3. Thu hồi tất cả refresh token cũ (an toàn)
        refreshTokenRepository.revokeAllByUser(user);

        // 4. Tạo token mới và trả về
        return generateAuthResponse(user);
    }

    // ==================== REFRESH TOKEN ====================

    /**
     * Đổi Refresh Token lấy Access Token mới.
     * Áp dụng Token Rotation: Mỗi lần refresh, token cũ bị thu hồi và tạo token mới.
     */
    @Transactional
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        // 1. Tìm refresh token trong database
        RefreshToken refreshToken = refreshTokenRepository.findByToken(request.getRefreshToken())
                .orElseThrow(() -> new ResourceNotFoundException("Refresh token không tồn tại"));

        // 2. Kiểm tra token còn hợp lệ không
        if (!refreshToken.isValid()) {
            throw new IllegalArgumentException("Refresh token đã hết hạn hoặc đã bị thu hồi");
        }

        // 3. Thu hồi token cũ (Token Rotation)
        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);

        // 4. Tạo token mới
        User user = refreshToken.getUser();
        return generateAuthResponse(user);
    }

    // ==================== HELPER METHODS ====================

    /**
     * Tạo AuthResponse gồm Access Token + Refresh Token.
     */
    private AuthResponse generateAuthResponse(User user) {
        // Tạo UserDetails để JwtService sử dụng
        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getEmail());

        // Tạo Access Token (JWT)
        String accessToken = jwtService.generateAccessToken(userDetails, user.getRole().name());

        // Tạo Refresh Token (UUID random, lưu DB)
        String refreshTokenValue = UUID.randomUUID().toString();
        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(refreshTokenValue)
                .expiresAt(LocalDateTime.now().plusSeconds(refreshTokenExpiration / 1000))
                .build();
        refreshTokenRepository.save(refreshToken);

        // Trả về response
        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenValue)
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }
}
