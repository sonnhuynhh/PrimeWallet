package com.sonnhuynhh.primewallet.wallet.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * Request xác minh quyền sở hữu: gửi address + signature + message đã ký.
 */
@Data
public class VerifyOwnershipRequest {

    @NotBlank(message = "Địa chỉ ví không được để trống")
    @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Địa chỉ ví không hợp lệ")
    private String address;

    @NotBlank(message = "Chuỗi signature không được để trống")
    private String signature;

    @NotBlank(message = "Message đã ký không được để trống")
    private String message;
}