package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Số dư của một token ERC-20 (hoặc native coin) trong ví.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenBalanceResponse {
    private String contractAddress; // null nếu là native coin
    private String symbol;
    private String name;
    private Integer decimals;
    private BigDecimal balance;      // đã chia theo decimals
    private String rawBalance;       // số nguyên gốc (wei/raw) ở dạng string
    private String logoUrl;          // logo token (tùy chọn)
    private Boolean isNative;        // true nếu là coin gốc mạng
}