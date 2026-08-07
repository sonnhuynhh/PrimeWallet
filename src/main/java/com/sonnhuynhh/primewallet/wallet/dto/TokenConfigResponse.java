package com.sonnhuynhh.primewallet.wallet.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Thông tin một token ERC-20 được cấu hình hỗ trợ trên một mạng.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenConfigResponse {
    private String symbol;
    private String name;
    private Integer decimals;
    private String contract;
}