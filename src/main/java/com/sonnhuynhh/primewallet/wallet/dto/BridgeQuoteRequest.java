package com.sonnhuynhh.primewallet.wallet.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BridgeQuoteRequest {

    @NotNull(message = "cryptoWalletId không được để trống")
    private UUID cryptoWalletId;

    @NotBlank(message = "tokenSymbol không được để trống")
    private String tokenSymbol;

    /** Để trống = native coin (ETH/BNB/...). */
    private String tokenAddress;

    /** Bắt buộc khi tokenAddress có giá trị. */
    private Integer tokenDecimals;

    @NotBlank(message = "amount không được để trống")
    @DecimalMin(value = "0.000000000000000001", message = "Số lượng phải lớn hơn 0")
    private String amount;
}
