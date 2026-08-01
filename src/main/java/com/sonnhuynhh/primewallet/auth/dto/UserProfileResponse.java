package com.sonnhuynhh.primewallet.auth.dto;

import com.sonnhuynhh.primewallet.auth.entity.KycStatus;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * DTO trả về thông tin profile của user.
 *
 * Tại sao cần DTO riêng thay vì trả thẳng Entity User?
 * → Bảo mật: Entity User chứa passwordHash, nếu trả thẳng
 *   thì password (dù đã mã hóa) vẫn bị lộ qua API.
 * → Kiểm soát: Ta chỉ trả về đúng những trường Frontend cần.
 *
 * @Builder: Cho phép tạo object bằng pattern:
 *   UserProfileResponse.builder().email("...").fullName("...").build()
 *   Dễ đọc hơn nhiều so với constructor có 7-8 tham số.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserProfileResponse {

    /** Email đăng nhập */
    private String email;

    /** Số điện thoại */
    private String phone;

    /** Họ và tên */
    private String fullName;

    /** Ngày sinh (có thể null nếu user chưa cập nhật) */
    private LocalDate dateOfBirth;

    /**
     * Trạng thái KYC (Know Your Customer):
     * - PENDING: Chưa xác thực danh tính
     * - VERIFIED: Đã xác thực (được phép giao dịch lớn)
     * - REJECTED: Bị từ chối xác thực
     */
    private KycStatus kycStatus;

    /** Trạng thái tài khoản: ACTIVE, LOCKED */
    private String status;

    /** Ngày tạo tài khoản */
    private LocalDateTime createdAt;
}
