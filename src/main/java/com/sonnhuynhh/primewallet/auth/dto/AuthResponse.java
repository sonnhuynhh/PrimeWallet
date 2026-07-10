package com.sonnhuynhh.primewallet.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO trả về cho client sau khi đăng nhập/đăng ký thành công.
 *
 * Gồm:
 * - accessToken: JWT token để gọi API (hết hạn sau 15 phút)
 * - refreshToken: Token để lấy accessToken mới (hết hạn sau 7 ngày)
 * - fullName, email, role: Thông tin hiển thị trên client
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {

    private String accessToken;
    private String refreshToken;
    private String fullName;
    private String email;
    private String role;
}
