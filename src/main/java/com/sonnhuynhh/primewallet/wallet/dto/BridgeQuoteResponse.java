package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BridgeQuoteResponse {

    private UUID orderId;
    private String blockchainNetwork;
    private String fromAddress;
    private String tokenSymbol;
    private String tokenAddress;
    private String tokenAmount;
    private String tokenAmountRaw;
    private BigDecimal vndAmount;
    private BigDecimal rateVnd;
    private String treasuryAddress;
    private LocalDateTime expiresAt;
    /** Nguồn tỷ giá: coingecko | fallback */
    private String rateSource;
    private Instant rateUpdatedAt;
}
