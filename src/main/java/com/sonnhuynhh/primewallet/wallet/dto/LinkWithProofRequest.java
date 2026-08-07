package com.sonnhuynhh.primewallet.wallet.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Yêu cầu liên kết ví kèm BẰNG CHỨNG QUYỀN SỞ HỮU (chữ ký của challenge).
 *
 * Non-custodial: server KHÔNG nhận private key / seed phrase.
 * Client ký challenge (từ GET /ownership/challenge) bằng private key của mình,
 * gửi signature → server recover address từ chữ ký → chỉ liên kết khi khớp.
 *
 * message: challenge (VD "PrimeWallet: verify wallet 0x... with nonce ...")
 * signature: "0x{r}{s}{v}" (65 bytes) do ethers.js signMessage sinh ra.
 */
@Data
public class LinkWithProofRequest {

    @NotBlank(message = "Địa chỉ ví không được để trống")
    @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Địa chỉ ví không đúng định dạng Ethereum")
    private String walletAddress;

    @NotBlank(message = "Mạng blockchain không được để trống")
    private String blockchainNetwork; // e.g. "eth_sepolia" (hỗ trợ cả "ETH_SEPOLIA" cũ)

    /** Tên hiển thị tùy chọn do user đặt (VD: "Ví chính"). */
    @Size(max = 60, message = "Tên ví tối đa 60 ký tự")
    private String label;

    /** Message challenge nhận từ GET /ownership/challenge. */
    @NotBlank(message = "Message challenge không được để trống")
    private String message;

    /** Chữ ký ethers.js ký message bằng private key (0x...). */
    @NotBlank(message = "Chữ ký không được để trống")
    private String signature;
}