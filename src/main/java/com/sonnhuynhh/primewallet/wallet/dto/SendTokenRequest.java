package com.sonnhuynhh.primewallet.wallet.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Request gửi token/native coin.
 *
 * Client ký giao dịch OFFLINE (non-custodial) rồi gửi signedTransactionHex
 * lên backend để broadcast. Các trường metadata chỉ để hiển thị/ghi lịch sử.
 */
@Data
public class SendTokenRequest {

    @NotBlank(message = "Mạng blockchain không được để trống")
    private String blockchainNetwork; // eth_sepolia

    @NotBlank(message = "Signed transaction hex không được để trống")
    private String signedTransactionHex;

    @NotBlank(message = "Địa chỉ ví nguồn không được để trống")
    @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Địa chỉ ví nguồn không hợp lệ")
    private String fromAddress;

    @NotBlank(message = "Địa chỉ ví nhận không được để trống")
    @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Địa chỉ ví nhận không hợp lệ")
    private String toAddress;

    @NotBlank(message = "Số tiền không được để trống")
    private String amount; // dạng chuỗi để tránh mất precision (VD "0.05")

    @NotBlank(message = "Ký hiệu token không được để trống")
    @Size(max = 10)
    private String symbol; // ETH, USDT, USDC

    /** Địa chỉ contract ERC-20 (rỗng/null nếu là native coin). */
    @Pattern(regexp = "^$|^0x[a-fA-F0-9]{40}$", message = "Contract address không hợp lệ")
    private String tokenAddress;
}