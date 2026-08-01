package com.sonnhuynhh.primewallet.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;

/**
 * DTO nhận yêu cầu đổi mật khẩu.
 *
 * Tại sao cần cả 3 trường?
 * 1. currentPassword: Xác nhận danh tính — nếu ai đó lấy được JWT token
 *    (ví dụ: mượn điện thoại), họ vẫn không thể đổi mật khẩu
 *    nếu không biết mật khẩu hiện tại.
 *
 * 2. newPassword: Mật khẩu mới.
 *
 * 3. confirmNewPassword: Tránh user gõ nhầm mật khẩu mới.
 *    Logic kiểm tra newPassword == confirmNewPassword sẽ nằm ở Service.
 *
 * Tại sao validation @Size(min=6)?
 * → Mật khẩu tối thiểu 6 ký tự là chuẩn bảo mật cơ bản.
 * → Ứng dụng thực tế có thể yêu cầu chứa ký tự đặc biệt, chữ hoa, số
 *   (sẽ bổ sung bằng @Pattern ở phase sau).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChangePasswordRequest {

    @NotBlank(message = "Mật khẩu hiện tại không được để trống")
    private String currentPassword;

    @NotBlank(message = "Mật khẩu mới không được để trống")
    @Size(min = 6, message = "Mật khẩu mới phải có ít nhất 6 ký tự")
    private String newPassword;

    @NotBlank(message = "Xác nhận mật khẩu không được để trống")
    private String confirmNewPassword;
}
