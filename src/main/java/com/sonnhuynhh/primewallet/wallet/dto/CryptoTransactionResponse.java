package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Một giao dịch Crypto do user thực hiện qua app (SEND).
 * Trạng thái: PENDING → SUCCESS/FAILED/CONFIRMED.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CryptoTransactionResponse {
    private UUID id;
    private String type;             // SEND
    private String txHash;
    private String fromAddress;
    private String toAddress;
    private BigDecimal amount;
    private String symbol;           // ETH, USDT, USDC
    private String tokenAddress;     // null nếu native
    private Long gasPriceWei;
    private Long gasLimit;
    private Long feeWei;
    private String status;           // PENDING/SUCCESS/FAILED/CONFIRMED
    private String description;
    private LocalDateTime createdAt;
}