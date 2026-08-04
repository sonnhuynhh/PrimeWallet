package com.sonnhuynhh.primewallet.auth.dto;

import com.sonnhuynhh.primewallet.auth.entity.KycStatus;
import com.sonnhuynhh.primewallet.auth.entity.Role;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO trả về thông tin user chi tiết — dành cho Admin.
 *
 * Khác với UserProfileResponse (dành cho user tự xem):
 * - Có thêm trường `id` (UUID) — Admin cần ID để thao tác (lock, KYC update)
 * - Có thêm trường `role` — Admin cần biết user là USER hay ADMIN
 * - KHÔNG có passwordHash (dù là Admin cũng không được xem mật khẩu)
 *
 * Tại sao cần DTO riêng cho Admin?
 * → Nguyên tắc Least Privilege (Quyền tối thiểu):
 *   User thường không cần biết UUID nội bộ hay role của mình qua API.
 *   Chỉ Admin mới cần thông tin này để quản lý.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminUserResponse {

    /** UUID nội bộ — Admin dùng để gọi API lock/KYC update */
    private UUID id;

    private String email;
    private String phone;
    private String fullName;
    private LocalDate dateOfBirth;

    /** Role: USER hoặc ADMIN */
    private Role role;

    /** Trạng thái KYC */
    private KycStatus kycStatus;

    /** Trạng thái tài khoản: ACTIVE hoặc LOCKED */
    private String status;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
