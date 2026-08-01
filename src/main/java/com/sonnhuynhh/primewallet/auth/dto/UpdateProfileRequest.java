package com.sonnhuynhh.primewallet.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.LocalDate;

/**
 * DTO nhận yêu cầu cập nhật thông tin cá nhân.
 *
 * Tại sao chỉ cho phép cập nhật fullName và dateOfBirth?
 * → email và phone là thông tin định danh, đổi email/phone
 *   cần quy trình xác thực riêng (gửi OTP, verify) — chưa làm ở phase này.
 * → passwordHash thay đổi qua API đổi mật khẩu riêng (Bước 2).
 *
 * Annotation validation:
 * - @NotBlank: Không được để trống hoặc chỉ có khoảng trắng
 * - @Size: Giới hạn độ dài chuỗi
 * - @Past: Ngày sinh phải là ngày trong quá khứ (không phải tương lai!)
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateProfileRequest {

    @NotBlank(message = "Họ tên không được để trống")
    @Size(min = 2, max = 100, message = "Họ tên phải từ 2 đến 100 ký tự")
    private String fullName;

    /**
     * Ngày sinh — không bắt buộc (có thể null).
     * @Past đảm bảo nếu user nhập thì phải là ngày trong quá khứ.
     * Ví dụ: 2000-01-15 → hợp lệ, 2099-01-01 → bị reject.
     */
    @Past(message = "Ngày sinh phải là ngày trong quá khứ")
    private LocalDate dateOfBirth;
}
