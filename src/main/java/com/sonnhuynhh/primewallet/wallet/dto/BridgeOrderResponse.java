package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BridgeOrderResponse {

    private UUID id;
    private String status;
    private String blockchainNetwork;
    private String fromAddress;
    private String tokenSymbol;
    private String tokenAddress;
    private String tokenAmount;
    private BigDecimal vndAmount;
    private BigDecimal rateVnd;
    private String treasuryAddress;
    private String depositTxHash;
    private UUID fiatTransactionId;
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;
}
