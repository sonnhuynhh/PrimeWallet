package com.sonnhuynhh.primewallet.wallet.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * Request ước tính gas cho một giao dịch (native hoặc ERC-20).
 */
@Data
public class EstimateGasRequest {

    @NotBlank(message = "Mạng blockchain không được để trống")
    private String blockchainNetwork; // eth_sepolia, bsc_testnet...

    @NotBlank(message = "Địa chỉ ví nguồn không được để trống")
    @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Địa chỉ ví nguồn không hợp lệ")
    private String fromAddress;

    @NotBlank(message = "Địa chỉ ví nhận không được để trống")
    @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Địa chỉ ví nhận không hợp lệ")
    private String toAddress;

    @NotBlank(message = "Số tiền không được để trống")
    private String amount; // VD "0.05" cho native, "100" cho USDT

    /** Contract ERC-20 (bỏ trống = native coin). */
    @Pattern(regexp = "^$|^0x[a-fA-F0-9]{40}$", message = "Contract address không hợp lệ")
    private String tokenAddress;

    /**
     * Số thập phân của token ERC-20 (USDT/USDC = 6, DAI = 18...). Chỉ dùng khi có
     * {@code tokenAddress}; bỏ trống thì mặc định 18 như phần lớn ERC-20.
     */
    @Min(value = 0, message = "Token decimals không hợp lệ")
    @Max(value = 36, message = "Token decimals không hợp lệ")
    private Integer tokenDecimals;
}