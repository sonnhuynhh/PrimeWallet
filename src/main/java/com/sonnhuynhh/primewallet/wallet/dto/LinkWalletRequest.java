package com.sonnhuynhh.primewallet.wallet.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class LinkWalletRequest {

    @NotBlank(message = "Địa chỉ ví không được để trống")
    @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Địa chỉ ví không đúng định dạng Ethereum")
    private String walletAddress;

    @NotBlank(message = "Mạng blockchain không được để trống")
    private String blockchainNetwork; // e.g. "eth_sepolia" (hỗ trợ cả "ETH_SEPOLIA" cũ)

    /** Tên hiển thị tùy chọn do user đặt (VD: "Ví chính"). */
    @Size(max = 60, message = "Tên ví tối đa 60 ký tự")
    private String label;

    // Để chứng minh quyền sở hữu wallet, cần ký một message challenge.
    // Xem CryptoOwnershipService. Giữ phần này open để mở rộng.
    // private String message;
    // private String signature;
}