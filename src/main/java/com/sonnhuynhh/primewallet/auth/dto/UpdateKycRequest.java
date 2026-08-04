package com.sonnhuynhh.primewallet.auth.dto;

import com.sonnhuynhh.primewallet.auth.entity.KycStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;

/**
 * DTO cho Admin cập nhật trạng thái KYC của user.
 *
 * KYC (Know Your Customer) là gì?
 * → Quy trình xác thực danh tính bắt buộc trong lĩnh vực tài chính.
 * → User phải cung cấp CMND/CCCD, ảnh selfie, v.v.
 * → Admin xem xét và cập nhật trạng thái: VERIFIED hoặc REJECTED.
 *
 * Tại sao cần trường `note`?
 * → Nếu Admin reject KYC, cần ghi rõ lý do (ví dụ: "Ảnh CCCD mờ").
 * → Note cũng giúp audit trail — sau này truy vết ai đã duyệt/từ chối và vì sao.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UpdateKycRequest {

    /**
     * Trạng thái KYC mới: PENDING, VERIFIED, hoặc REJECTED.
     * @NotNull bắt buộc phải có giá trị (không được null).
     */
    @NotNull(message = "Trạng thái KYC không được để trống")
    private KycStatus kycStatus;

    /**
     * Ghi chú lý do (tùy chọn, tối đa 500 ký tự).
     * Ví dụ: "Đã xác thực CCCD số 0123456789" hoặc "Ảnh CCCD không rõ ràng".
     */
    @Size(max = 500, message = "Ghi chú không được quá 500 ký tự")
    private String note;
}
